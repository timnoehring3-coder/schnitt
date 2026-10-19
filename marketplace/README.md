# schnitt-marketplace

Marketplace-Manifest für das Plugin „schnitt“. Der Inhalt dieses Ordners wird 1:1 in das öffentliche Repo
`schnitt-marketplace` gespiegelt (`.claude-plugin/marketplace.json` im Wurzelverzeichnis).

```
/plugin marketplace add timnoehring3-coder/schnitt-marketplace
/plugin install schnitt
```

Releases: Git-Tag `v1` im Plugin-Repo wird bei jedem Release fast-forward gesetzt (`git tag -f v1 && git push -f origin v1`),
damit `/plugin update schnitt` den neuen Stand zieht. Versionsnummer in `.claude-plugin/plugin.json` hochzählen.
