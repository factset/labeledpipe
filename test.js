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

function emitError (label) {
    return through.obj(transform);

    function transform (file, enc, done) {
        this.emit('error', new Error('Error from ' + label));
    }
}


var stream = through.obj();

stream
    .pipe(reportStage('A'))
    .pipe(reportStage('B'))
    .pipe(reportStage('C'))
;

var first = labeledpipe()
    .pipe('A', reportStage, 'A')
    .pipe('B', reportStage, 'B')
    .pipe('C', reportStage, 'C')
    .pipe('X', emitError,   'X')
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


var pipeline = stream.pipe(third());

pipeline.on('error', function () {
    console.log('Caught error');
});


stream.write({});
stream.end();
