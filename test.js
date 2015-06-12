'use strict';

var labeledpipe = require('./index');
var through     = require('through2');

function reportStage (label) {
    return through.obj(transform, flush);

    function transform (file, enc, done) {
        console.log(label + ':', file);
        done(null, file);
    }

    function flush (done) {
        console.log(label + ': Done');
        done();
    }
}

var stream = through.obj();

// stream
//     .pipe(reportStage('A'))
//     .pipe(reportStage('B'))
//     .pipe(reportStage('C'))
// ;

var first = labeledpipe()
    .pipe('A', reportStage, 'A')
    .pipe('B', reportStage, 'B')
    .pipe('C', reportStage, 'C')
;

var second = labeledpipe()
    .pipe('D', reportStage, 'D')
    .pipe('E', reportStage, 'E')
    .pipe('F', reportStage, 'F')
;

var third = labeledpipe()
    .pipe('first', first)
    .pipe('second', second)
    .remove('first')
    .after('second')
    .pipe(first)
;


stream.pipe(third());

stream.write({});
stream.end();
