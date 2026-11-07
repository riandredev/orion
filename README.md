<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/orion-wordmark.png" />
    <img src="images/orion-wordmark-light.png" alt="Orion" width="360" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/riandredev/orion/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/riandredev/orion?style=social" /></a>
  <a href="LICENSE"><img alt="GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-2ea44f?style=flat" /></a>
  <a href="https://github.com/riandredev/orion/releases"><img alt="Windows and Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-555555?style=flat" /></a>
</p>

<p align="center">
  <a href="https://github.com/riandredev/orion/releases">Releases</a>
  &nbsp;•&nbsp;
  <a href="https://github.com/riandredev/orion/issues">Issues</a>
  &nbsp;•&nbsp;
  <a href="LICENSE">License</a>
</p>

Orion runs a church service from one computer and sends hymns, scripture, and slides to the displays.

## Download

| Edition | Library |
| --- | --- |
| [Orion](https://github.com/riandredev/orion/releases/tag/v1.0.1) | Empty. Add your own service-order images, hymnals, and Bibles. |
| [Orion Panorama](https://github.com/riandredev/orion/releases/tag/v1.0.1-panorama) | Service-order images, Afrikaans and English Adventist hymnals, the King James Version, and Afrikaans 1953. |

The two editions install side by side and do not share libraries.

## Develop

```bash
npm install
npm run dev
npm run build && npm run preview
```

```bash
npm run dist:win
npm run dist:linux
npm run dist:panorama:win
npm run dist:panorama:linux
```

## License

Bundled order images, hymnals, and Bible texts keep their own terms.
