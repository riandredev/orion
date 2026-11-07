# Orion

Presentation software for church services. Run the service from one computer and send hymns, scripture, and slides to the displays.

## Install

Download a build from the [releases](https://github.com/riandredev/orion/releases).

| Edition | What you get |
| --- | --- |
| **Orion** | Empty libraries. Add your own service-order images, hymnals, and Bibles. |
| **Orion Panorama** | A prepared library: service-order images, Afrikaans and English Adventist hymnals, the King James Version, and Afrikaans 1953. |

Each edition has a Windows setup and a Linux AppImage. They install side by side and do not share libraries.

Windows may warn that the installer is unsigned.

## What it does

- Project a service order, hymns, and Bible passages
- Play slide decks, video, and web pages on the outputs
- Send the picture to more than one display, with a preview of each
- Save settings as profiles you can export and import

## Develop

```bash
npm install
npm run dev
```

`npm run build` then `npm run preview` runs the packaged interface locally.

```bash
npm run dist:win
npm run dist:linux
npm run dist:panorama:win
npm run dist:panorama:linux
```

## License

[GNU GPL v3](LICENSE). The license covers the Orion program. Bundled order images, hymnals, and Bible texts keep their own terms.
