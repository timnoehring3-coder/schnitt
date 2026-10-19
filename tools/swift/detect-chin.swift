// detect-chin.swift — Kinnhöhe in einem Bild via Apple Vision (Face Landmarks).
//
//   swift system/bin/detect-chin.swift <bild.jpg>
//
// Ausgabe (stdout, eine Zeile JSON): {"ok":true,"chinY":0.6312,"faceWidth":0.42}
//   chinY: normalisiert, 0 = Bildoberkante, 1 = Unterkante — tiefster Punkt der
//   Gesichtskontur des GRÖSSTEN Gesichts (Fallback: Unterkante der Face-Box).
// Kein Gesicht/Fehler: {"ok":false,"error":"..."} + Exit 1.
// Genutzt vom Worker (detectChinY), um die Kamera-Untertitel UNTER Tims Kinn zu
// positionieren — einmal aus dem ersten Frame erkannt, fürs ganze Video fixiert.
import Foundation
import Vision
import AppKit

func fail(_ msg: String) -> Never {
  print("{\"ok\":false,\"error\":\"\(msg)\"}")
  exit(1)
}

guard CommandLine.arguments.count > 1 else { fail("kein Bildpfad") }
let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fail("Bild nicht lesbar") }

let request = VNDetectFaceLandmarksRequest()
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
do { try handler.perform([request]) } catch { fail("Vision-Fehler") }

// Mini-Gesichter (Hintergrund/Poster) ignorieren, dann das größte nehmen.
let faces = (request.results ?? []).filter { $0.boundingBox.width > 0.05 }
guard let face = faces.max(by: { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }) else {
  fail("kein Gesicht gefunden")
}

// Vision liefert normalisierte Koordinaten mit Ursprung UNTEN links.
// Tiefster Punkt der Gesichtskontur = Kinnspitze; Fallback: Unterkante der Box.
var lowestY = Double(face.boundingBox.minY)
if let contour = face.landmarks?.faceContour {
  let pts = contour.pointsInImage(imageSize: CGSize(width: 1, height: 1))
  if let minPt = pts.min(by: { $0.y < $1.y }) { lowestY = Double(minPt.y) }
}
let chinY = min(max(1.0 - lowestY, 0.0), 1.0) // auf Oben-Ursprung drehen
print(String(format: "{\"ok\":true,\"chinY\":%.4f,\"faceWidth\":%.3f}", chinY, Double(face.boundingBox.width)))
