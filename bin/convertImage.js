const sharp = require("sharp");
const fs = require("fs");

const folderInput = `public/assets/images`;
const folderOutput = `public/assets/images`;

fs.readdir(folderInput, (err, files) => {
  if (err) throw err;
  files.forEach((file) => {
    const src = `${folderInput}/${file}`;
    const fileName = file.split(".png")[0];
    const destDefault = `${folderOutput}/${fileName}.webp`;
    // File destination will be created or overwritten by default.
    sharp(src)
      .webp()
      .toFile(destDefault, (err, info) => {
        if (err) throw err;
        console.log(`${src} was copied to ${destDefault}`);
      });
  });
});
