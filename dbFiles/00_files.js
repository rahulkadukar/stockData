const fileSeq = require('./rawFiles/fileSequence');
let fs = require('fs');
let fileNum = 1;

for (let i = 0; i < fileSeq.length; ++i) {
  let fileName = fileNum.toString(10).padStart(2, "0") + '_' + fileSeq[i].name + '.js';
  let origName = './rawFiles/' + fileSeq[i].name + '.js';
  fs.createReadStream(origName).pipe(fs.createWriteStream(fileName));

  console.log(fileName);
}
