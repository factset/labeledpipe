'use strict';

var chai        = require('chai');
var through     = require('through2');
var lazypipe    = require('lazypipe');
var labeledpipe = require('../index');
var expect      = chai.expect;

describe('labeledpipe', function () {
    it('should be a function', function () {
        expect(labeledpipe).to.be.a('function');
    });

    var pipeline;
    beforeEach(function () {
        pipeline = labeledpipe();
    });

    it('should create a function', function () {
        expect(pipeline).to.be.a('function');
    });

    it('should build a steam', function () {
        var stream = pipeline();
        // jshint -W030
        expect(stream).to.have.property('writable').to.be.true;
        expect(stream).to.have.property('readable').to.be.true;
        expect(stream).to.have.property('write').to.be.a('function');
        expect(stream).to.have.property('push').to.be.a('function');
    });

    it('should have the labeledpipe API', function () {
        expect(pipeline).to.have.property('pipe').to.be.a('function');
        expect(pipeline).to.have.property('before').to.be.a('function');
        expect(pipeline).to.have.property('after').to.be.a('function');
        expect(pipeline).to.have.property('remove').to.be.a('function');
        expect(pipeline).to.have.property('first').to.be.a('function');
        expect(pipeline).to.have.property('last').to.be.a('function');
        expect(pipeline).to.have.property('appendStepsTo').to.be.a('function');
    });

    var builtStreams;
    var pipelineEvents;
    beforeEach(function () {
        builtStreams   = [];
        pipelineEvents = [];
    });

    describe('.pipe', function () {
        it('should return a new pipeline', function () {
            expect(pipeline.pipe(reportStage)).not.to.equal(pipeline);
        });

        it('should not build the new stream', function () {
            pipeline.pipe(reportStage, 'A');

            expect(builtStreams).to.deep.equal([]);
            expect(pipelineEvents).to.deep.equal([]);
        });

        it('should add a stream that is build with the pipeline', function () {
            pipeline = pipeline.pipe(reportStage, 'A');
            pipeline();
            expect(builtStreams).to.deep.equal([ 'A' ]);
            expect(pipelineEvents).to.deep.equal([]);
        });

        it('should pipe objects to the added stream', function () {
            pipeline = pipeline.pipe(reportStage, 'A');
            var stream = pipeline();

            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A' ]);
        });

        it('should allow piping to labeledpipe', function () {
            var other = labeledpipe().pipe(reportStage, 'A');
            pipeline  = pipeline.pipe(other);
            var stream = pipeline();

            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A' ]);
        });

        it('should allow piping to lazypipe', function () {
            var other = lazypipe().pipe(reportStage, 'A');
            pipeline  = pipeline.pipe(other);
            var stream = pipeline();

            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A' ]);
        });

        it('should allow piping from lazypipe', function () {
            pipeline   = pipeline.pipe(reportStage, 'A');
            var other  = lazypipe().pipe(pipeline);
            var stream = other();

            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A' ]);
        });
    });

    describe('.before', function () {
        it('should change the append location to before label', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
                .before('A')
                .pipe('C', reportStage, 'C')
                .pipe('D', reportStage, 'D')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'C', 'D', 'A', 'B' ]);
        });

        it('should change the append location to before label in sub-pipeline', function () {
            var other = labeledpipe()
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
            ;

            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe(other)
                .before('C')
                .pipe('D', reportStage, 'D')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'B', 'D', 'C' ]);
        });

        it('should change the append location to before label sub-pipeline', function () {
            var other = labeledpipe()
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
            ;

            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('other', other)
                .pipe('D', reportStage, 'D')
                .before('other')
                .pipe('E', reportStage, 'E')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'E', 'B', 'C', 'D' ]);
        });

        it('should throw an error if the label doesn\'t exist', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
            ;
            function removeC () {
                pipeline = pipeline.before('C');
            }

            expect(removeC).to.throw(Error, 'Unable to move cursor before step C');
        });
    });

    describe('.after', function () {
        it('should change the append location to after label', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
                .after('A')
                .pipe('C', reportStage, 'C')
                .pipe('D', reportStage, 'D')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'C', 'D', 'B' ]);
        });

        it('should change the append location to after label in sub-pipeline', function () {
            var other = labeledpipe()
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
            ;

            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe(other)
                .after('B')
                .pipe('D', reportStage, 'D')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'B', 'D', 'C' ]);
        });

        it('should change the append location to after label sub-pipeline', function () {
            var other = labeledpipe()
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
            ;

            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('other', other)
                .pipe('D', reportStage, 'D')
                .after('other')
                .pipe('E', reportStage, 'E')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'B', 'C', 'E', 'D' ]);
        });

        it('should throw an error if the label doesn\'t exist', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
            ;
            function removeC () {
                pipeline = pipeline.after('C');
            }

            expect(removeC).to.throw(Error, 'Unable to move cursor after step C');
        });
    });

    describe('.remove', function () {
        it('should be able to remove step from pipeline', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
                .remove('B')
            ;

            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'C' ]);
        });

        it('should be able to remove step from sub-pipeline', function () {
            var other = labeledpipe()
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
            ;
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe(other)
                .remove('B')
            ;

            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'C' ]);
        });

        it('should be able to remove sub-pipeline', function () {
            var other = labeledpipe()
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
            ;
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('other', other)
                .pipe('D', reportStage, 'D')
                .remove('other')
            ;

            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'D' ]);
        });

        it('should not change cursor position if cursor is before removed stream', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
                .before('A')
                .remove('B')
                .pipe('D', reportStage, 'D')
            ;

            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'D', 'A', 'C' ]);
        });

        it('should change cursor position if cursor is after removed stream', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
                .after('B')
                .remove('B')
                .pipe('D', reportStage, 'D')
            ;

            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'D', 'C' ]);
        });

        it('should change cursor position if cursor inside remove stream', function () {
            var other = labeledpipe()
                .pipe('B', reportStage, 'B')
                .pipe('C', reportStage, 'C')
            ;
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('other', other)
                .pipe('D', reportStage, 'D')
                .after('B')
                .remove('other')
                .pipe('E', reportStage, 'E')
            ;

            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'A', 'E', 'D' ]);
        });

        it('should throw an error if the label doesn\'t exist', function () {
            pipeline = pipeline
                .pipe('A', reportStage, 'A')
                .pipe('B', reportStage, 'B')
            ;
            function removeC () {
                pipeline = pipeline.remove('C');
            }

            expect(removeC).to.throw(Error, 'Unable to remove step C');
        });
    });

    describe('.first', function () {
        it('should change the append location to the beginning', function () {
            pipeline = pipeline
                .pipe(reportStage, 'A')
                .first()
                .pipe(reportStage, 'B')
                .pipe(reportStage, 'C')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'B', 'C', 'A' ]);
        });
    });

    describe('.last', function () {
        it('should change the append location to the end', function () {
            pipeline = pipeline
                .pipe(reportStage, 'A')
                .first()
                .pipe(reportStage, 'B')
                .last()
                .pipe(reportStage, 'C')
            ;
            var stream = pipeline();
            stream.end({});
            expect(pipelineEvents).to.deep.equal([ 'B', 'A', 'C' ]);
        });
    });

    function reportStage (label) {
        builtStreams.push(label);

        return through.obj(transform);
        function transform (file, enc, done) {
            pipelineEvents.push(label);
            done(null, file);
        }
    }
});
