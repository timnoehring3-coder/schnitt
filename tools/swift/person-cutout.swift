// person-cutout.swift — Person aus einem Video freistellen (Apple Vision, on-device).
//
//   swift system/bin/person-cutout.swift <in.mp4> <out.mov> [--seconds N] [--quality accurate|balanced|fast]
//                                 [--feather PX] [--codec hevc|prores]
//
// Schreibt ein .mov MIT ALPHA: die Person bleibt, der Hintergrund wird transparent.
// Gebraucht für den Split-Modus aus wissen/doku/CUT-STYLE.md — dort liegt die Kamera als gerundete Karte
// im unteren Bildteil, und der freigestellte Kopf überragt deren Oberkante. Ohne Freisteller
// ist das nicht baubar (Palmiers apply_effect 'key' ist ein Chroma-/Luma-Key und taugt für ein
// Wohnzimmer-Setup nicht).
//
// Codec: hevcWithAlpha (Default) — in Palmier verifiziert und ~17× kleiner als ProRes 4444
// (16 s: 22 MB statt 388 MB). `--codec prores` erzwingt ProRes 4444, falls HEVC klemmt.
//
// Ton wird NICHT übernommen — der Ton kommt in der Montage vom Karten-Clip darunter.
// Fortschritt als "@@PROGRESS <pct> Freistellen" auf stderr (Worker-Konvention).
// Ergebnis auf stdout, eine Zeile JSON:
//   {"ok":true,"frames":481,"width":1080,"height":1920,"headTop":0.4198,"codec":"hevc"}
// `headTop` = normalisierte Oberkante der Person (0 = Bildoberkante), Median über Stichproben.
// /montage rechnet daraus die Kartengeometrie aus — siehe wissen/doku/PALMIER-GEOMETRY.md.
import Foundation
import AVFoundation
import Vision
import CoreImage
import VideoToolbox

func fail(_ msg: String) -> Never {
  print("{\"ok\":false,\"error\":\"\(msg.replacingOccurrences(of: "\"", with: "'"))\"}")
  exit(1)
}
func note(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }

// --- Argumente ---------------------------------------------------------------
var args = Array(CommandLine.arguments.dropFirst())
func flag(_ name: String) -> String? {
  guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
  let v = args[i + 1]; args.removeSubrange(i...(i + 1)); return v
}
let maxSeconds = Double(flag("--seconds") ?? "") ?? .infinity
let qualityArg = flag("--quality") ?? "accurate"
let feather = Double(flag("--feather") ?? "") ?? 1.5
let codecArg = flag("--codec") ?? "hevc"
guard args.count >= 2 else { fail("Aufruf: person-cutout.swift <in> <out.mov> [--seconds N] [--quality accurate|balanced|fast] [--feather PX] [--codec hevc|prores]") }
let inURL = URL(fileURLWithPath: args[0])
let outURL = URL(fileURLWithPath: args[1])
guard FileManager.default.fileExists(atPath: inURL.path) else { fail("Eingang fehlt: \(inURL.path)") }
try? FileManager.default.removeItem(at: outURL)

let quality: VNGeneratePersonSegmentationRequest.QualityLevel = {
  switch qualityArg {
  case "fast": return .fast
  case "balanced": return .balanced
  default: return .accurate
  }
}()

// --- Eingang lesen -----------------------------------------------------------
let asset = AVURLAsset(url: inURL)
var track: AVAssetTrack?
var durationSec: Double = 0
var nominalFps: Float = 30
var natSize = CGSize.zero
var xform = CGAffineTransform.identity
let sem = DispatchSemaphore(value: 0)
Task {
  track = try? await asset.loadTracks(withMediaType: .video).first
  if let d = try? await asset.load(.duration) { durationSec = CMTimeGetSeconds(d) }
  if let t = track {
    if let f = try? await t.load(.nominalFrameRate) { nominalFps = f }
    natSize = (try? await t.load(.naturalSize)) ?? .zero
    xform = (try? await t.load(.preferredTransform)) ?? .identity
  }
  sem.signal()
}
sem.wait()
guard let vTrack = track else { fail("keine Videospur") }

// Nach einer 90°-Rotation im Container tauschen Breite/Höhe.
let rotated = abs(xform.b) == 1 && abs(xform.c) == 1
let outW = Int(rotated ? natSize.height : natSize.width)
let outH = Int(rotated ? natSize.width : natSize.height)
guard outW > 0, outH > 0 else { fail("Bildmaße unlesbar") }
if !xform.isIdentity { note("[person-cutout] Hinweis: Spur trägt eine Transform-Matrix (rotiert=\(rotated)).") }

guard let reader = try? AVAssetReader(asset: asset) else { fail("Reader-Fehler") }
let readerOut = AVAssetReaderTrackOutput(track: vTrack, outputSettings: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
])
readerOut.alwaysCopiesSampleData = false
guard reader.canAdd(readerOut) else { fail("Reader-Output abgelehnt") }
reader.add(readerOut)

// --- Ausgang schreiben (Alpha!) ----------------------------------------------
guard let writer = try? AVAssetWriter(outputURL: outURL, fileType: .mov) else { fail("Writer-Fehler") }
var settings: [String: Any] = [AVVideoWidthKey: outW, AVVideoHeightKey: outH]
if codecArg == "prores" {
  settings[AVVideoCodecKey] = AVVideoCodecType.proRes4444
} else {
  settings[AVVideoCodecKey] = AVVideoCodecType.hevcWithAlpha
  settings[AVVideoCompressionPropertiesKey] = [
    kVTCompressionPropertyKey_TargetQualityForAlpha as String: 0.95,
    AVVideoQualityKey: 0.9,
  ]
}
let writerIn = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
writerIn.expectsMediaDataInRealTime = false
writerIn.transform = .identity
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: writerIn, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: outW,
  kCVPixelBufferHeightKey as String: outH,
  kCVPixelBufferIOSurfacePropertiesKey as String: [:],
])
guard writer.canAdd(writerIn) else { fail("Writer-Input abgelehnt (Codec \(codecArg) nicht verfügbar?)") }
writer.add(writerIn)
guard writer.startWriting() else { fail("startWriting: \(writer.error?.localizedDescription ?? "unbekannt")") }
writer.startSession(atSourceTime: .zero)
guard reader.startReading() else { fail("startReading: \(reader.error?.localizedDescription ?? "unbekannt")") }

// --- Verarbeitung ------------------------------------------------------------
let ciCtx = CIContext(options: [.cacheIntermediates: false])
let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = quality
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
// Sequence-Handler statt Einzelbild-Handler: gibt Vision zeitlichen Kontext und reduziert das
// Flackern der Maskenkante zwischen aufeinanderfolgenden Frames spürbar.
let seqHandler = VNSequenceRequestHandler()

// Oberkante der Person je Stichprobe — /montage braucht sie für die Kartengeometrie.
// Median statt Minimum: eine kurz gehobene Hand soll den Wert nicht verreißen.
var headTops: [Double] = []
let SAMPLE_EVERY = 15

func scanHeadTop(_ mask: CVPixelBuffer) -> Double? {
  CVPixelBufferLockBaseAddress(mask, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
  guard let base = CVPixelBufferGetBaseAddress(mask) else { return nil }
  let w = CVPixelBufferGetWidth(mask), h = CVPixelBufferGetHeight(mask)
  let stride = CVPixelBufferGetBytesPerRow(mask)
  let p = base.assumingMemoryBound(to: UInt8.self)
  for y in 0..<h {
    let row = p + y * stride
    var x = 0
    while x < w {
      if row[x] > 128 { return Double(y) / Double(h) }  // CVPixelBuffer-Zeilen laufen von oben
      x += 2
    }
  }
  return nil
}

let totalFramesEstimate = max(1, Int(min(durationSec, maxSeconds) * Double(nominalFps)))
var written = 0
var lastPct = -1
let queue = DispatchQueue(label: "person-cutout")
let done = DispatchSemaphore(value: 0)
var writeError: String?

writerIn.requestMediaDataWhenReady(on: queue) {
  while writerIn.isReadyForMoreMediaData {
    guard let sample = readerOut.copyNextSampleBuffer() else {
      writerIn.markAsFinished(); done.signal(); return
    }
    let pts = CMSampleBufferGetPresentationTimeStamp(sample)
    if CMTimeGetSeconds(pts) > maxSeconds {
      writerIn.markAsFinished(); reader.cancelReading(); done.signal(); return
    }
    guard let frame = CMSampleBufferGetImageBuffer(sample) else { continue }

    var maskImage: CIImage?
    do {
      try seqHandler.perform([request], on: frame)
      if let obs = request.results?.first {
        if written % SAMPLE_EVERY == 0, let t = scanHeadTop(obs.pixelBuffer) { headTops.append(t) }
        let m = CIImage(cvPixelBuffer: obs.pixelBuffer)
        // Vision liefert die Maske kleiner als das Bild — auf Framegröße ziehen.
        var scaled = m.transformed(by: CGAffineTransform(
          scaleX: CGFloat(outW) / m.extent.width, y: CGFloat(outH) / m.extent.height))
        if feather > 0 {
          scaled = scaled.clampedToExtent().applyingGaussianBlur(sigma: feather)
            .cropped(to: CGRect(x: 0, y: 0, width: CGFloat(outW), height: CGFloat(outH)))
        }
        maskImage = scaled
      }
    } catch {
      writeError = "Vision: \(error.localizedDescription)"
    }

    let rect = CGRect(x: 0, y: 0, width: CGFloat(outW), height: CGFloat(outH))
    let src = CIImage(cvPixelBuffer: frame)
    let composed: CIImage
    if let mask = maskImage {
      // Person behalten, Hintergrund transparent: Quelle gegen ein leeres (klares) Bild durch
      // die Maske blenden. Ergebnis trägt echtes Alpha.
      let f = CIFilter(name: "CIBlendWithMask")!
      f.setValue(src, forKey: kCIInputImageKey)
      f.setValue(CIImage.empty(), forKey: kCIInputBackgroundImageKey)
      f.setValue(mask, forKey: kCIInputMaskImageKey)
      composed = (f.outputImage ?? src).cropped(to: rect)
    } else {
      // Kein Personenfund → vollständig transparent lassen, damit NIE versehentlich der
      // Hintergrund durchkommt (im Split-Modus sofort sichtbar).
      composed = CIImage.empty().cropped(to: rect)
    }

    var pb: CVPixelBuffer?
    guard let pool = adaptor.pixelBufferPool,
          CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb) == kCVReturnSuccess,
          let outBuf = pb else { writeError = "Pixelbuffer-Pool leer"; break }
    ciCtx.render(composed, to: outBuf, bounds: rect, colorSpace: CGColorSpaceCreateDeviceRGB())
    if !adaptor.append(outBuf, withPresentationTime: pts) {
      writeError = "append: \(writer.error?.localizedDescription ?? "unbekannt")"; break
    }
    written += 1
    let pct = min(99, Int(Double(written) / Double(totalFramesEstimate) * 100))
    if pct != lastPct { lastPct = pct; note("@@PROGRESS \(pct) Freistellen") }
  }
  if writeError != nil { writerIn.markAsFinished(); done.signal() }
}
done.wait()

let finish = DispatchSemaphore(value: 0)
writer.finishWriting { finish.signal() }
finish.wait()

if let e = writeError { fail(e) }
if writer.status != .completed { fail("Writer-Status \(writer.status.rawValue): \(writer.error?.localizedDescription ?? "unbekannt")") }
guard written > 0 else { fail("kein Frame geschrieben") }

let headTop: String = {
  guard !headTops.isEmpty else { return "null" }
  let s = headTops.sorted()
  return String(format: "%.4f", s[s.count / 2])
}()
print("{\"ok\":true,\"frames\":\(written),\"width\":\(outW),\"height\":\(outH),\"headTop\":\(headTop),\"codec\":\"\(codecArg)\"}")
