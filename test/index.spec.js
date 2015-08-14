'use strict';

// jshint -W030

var chai        = require('chai');
var sinon       = require('sinon');
var sinonChai   = require('sinon-chai');
var through     = require('through2');
var lazypipe    = require('lazypipe');
var labeledpipe = require('../index');
var expect      = chai.expect;

chai.use(sinonChai);

describe('labeledpipe', function () {
    it('should be a function', function () {
        expect(labeledpipe).to.be.a('function');
    });

    it('should provide access to the LabeledPipe constructor', function () {
        expect(labeledpipe).to.have.property('LabeledPipe').to.be.a('function');
    });

    describe('()', function () {
        var pipeline;
        beforeEach(function () {
            pipeline = labeledpipe('testDisplayName');
        });

        it('should create a function', function () {
            expect(pipeline).to.be.a('function');
        });

        it('should set a display name on the build function', function () {
            expect(pipeline).to.have.property('displayName').to.equal('testDisplayName');
        });

        it('should build a steam', function () {
            var stream = pipeline();
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

            labeledpipe.LabeledPipe.CHAINABLE_EVENT_EMITTER_METHODS.forEach(function (method) {
                expect(pipeline).to.have.property(method).to.be.a('function');
            });
        });

        var builtStreams;
        var pipelineEvents;
        var spies;
        beforeEach(function () {
            builtStreams   = [];
            pipelineEvents = [];
            spies          = {};
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

            it('should allow adding markers', function () {
                pipeline = pipeline
                    .pipe(reportStage, 'A')
                    .pipe('B')
                ;
                pipeline();
                expect(builtStreams).to.deep.equal([ 'A' ]);
                expect(pipelineEvents).to.deep.equal([]);
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

        describe('.beginningOf', function () {
            it('should change the append location to after beginning of a marker', function () {
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('MissingLetters')
                    .pipe('B', reportStage, 'B')

                    .beginningOf('MissingLetters')
                    .pipe('Y', reportStage, 'Y')
                    .beginningOf('MissingLetters')
                    .pipe('X', reportStage, 'X')
                ;
                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'X', 'Y', 'B' ]);
            });

            it('should change the append location to after beginning of a sub-pipeline', function () {
                var other = labeledpipe()
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                ;
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('OtherThings', other)
                    .pipe('D', reportStage, 'D')
                    .beginningOf('OtherThings')
                    .pipe('X', reportStage, 'X')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'X', 'B', 'C', 'D' ]);
            });
        });

        describe('.endOf', function () {
            it('should change the append location to before end of a marker', function () {
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('MissingLetters')
                    .pipe('B', reportStage, 'B')

                    .endOf('MissingLetters')
                    .pipe('X', reportStage, 'X')
                ;
                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'X', 'B' ]);
            });

            it('should change the append location to before end of a sub-pipeline', function () {
                var other = labeledpipe()
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                ;
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('OtherThings', other)
                    .pipe('D', reportStage, 'D')

                    .endOf('OtherThings')
                    .pipe('X', reportStage, 'X')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'B', 'C', 'X', 'D' ]);
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

        describe('.replace', function () {
            it('should be able to repalce step in a pipeline', function () {
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                    .replace('B', reportStage, 'D')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'D', 'C' ]);
            });

            it('should be able to replace a step in a sub-pipeline', function () {
                var other = labeledpipe()
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                ;
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe(other)
                    .replace('B', reportStage, 'D')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'D', 'C' ]);
            });

            it('should be able to replace a sub-pipeline', function () {
                var other = labeledpipe()
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                ;
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('other', other)
                    .pipe('D', reportStage, 'D')
                    .replace('other', reportStage, 'E')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'E', 'D' ]);
            });

            it('should not change cursor position if cursor is before replaced stream', function () {
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                    .before('A')
                    .replace('B', reportStage, 'E')
                    .pipe('D', reportStage, 'D')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'D', 'A', 'E', 'C' ]);
            });

            it('should change cursor position if cursor is after replaced stream', function () {
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                    .after('B')
                    .replace('B', reportStage, 'E')
                    .pipe('D', reportStage, 'D')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'E', 'D', 'C' ]);
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
                    .replace('other', reportStage, 'F')
                    .pipe('E', reportStage, 'E')
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'F', 'E', 'D' ]);
            });

            it('should throw an error if the label doesn\'t exist', function () {
                pipeline = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('B', reportStage, 'B')
                ;
                function removeC () {
                    pipeline = pipeline.replace('C', reportStage, 'D');
                }

                expect(removeC).to.throw(Error, 'Unable to remove step C');
            });

            it('should allow replacing with a labeledpipe', function () {
                var other = labeledpipe().pipe(reportStage, 'D');
                pipeline  = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                    .replace('B', other)
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'D', 'C' ]);
            });

            it('should allow replacing with a lazypipe', function () {
                var other = lazypipe().pipe(reportStage, 'D');
                pipeline  = pipeline
                    .pipe('A', reportStage, 'A')
                    .pipe('B', reportStage, 'B')
                    .pipe('C', reportStage, 'C')
                    .replace('B', other)
                ;

                var stream = pipeline();
                stream.end({});
                expect(pipelineEvents).to.deep.equal([ 'A', 'D', 'C' ]);
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

        var eventArgs = {
            'addListener':        [ 'event', function () {} ],
            'on':                 [ 'event', function () {} ],
            'once':               [ 'event', function () {} ],
            'removeListener':     [ 'event', function () {} ],
            'removeAllListeners': [ 'event' ],
            'setMaxListeners':    [ 10 ]
        };

        Object
            .keys(eventArgs)
            .forEach(function (method) {
                describe('.' + method, function () {
                    it('should proxy to pipeline stage under the cursor', function () {
                        pipeline = pipeline.pipe(eventSpy, method);
                        pipeline = pipeline[method].apply(pipeline, eventArgs[method]);

                        expect(spies[method]).to.not.be.defined;

                        var stream = pipeline();
                        expect(spies[method]).to.be.defined;
                        expect(spies[method]).to.have.been.calledWith(eventArgs[method][0]);
                        stream.end();
                    });

                    it('should throw an error if there isn\'t a task under the cursor', function () {
                        expect(pipeline[method]).to.throw('No event emitter under cursor');
                    });

                    it('should handle events when passed to a lazypipe', function () {
                        pipeline = pipeline.pipe(eventSpy, method);
                        pipeline = pipeline[method].apply(pipeline, eventArgs[method]);
                        expect(spies[method]).to.not.be.defined;

                        var stream = lazypipe().pipe(pipeline)();
                        expect(spies[method]).to.be.defined;
                        expect(spies[method]).to.have.been.calledWith(eventArgs[method][0]);
                        stream.end();
                    });
                });
            })
        ;

        describe('error handling', function () {
            it('should bubble errors from pipeline to stream', function (done) {
                var handler = sinon.spy();
                var stream  = pipeline
                    .pipe(emitError, 'error text')
                    ()
                ;

                stream.on('error', handler);
                stream.end({});

                process.nextTick(function () {
                    expect(handler).to.have.been.calledOnce;
                    done();
                });
            });

            it('should not bubble errors that were handled in a single stage pipeline', function (done) {
                var streamHandler   = sinon.spy();
                var pipelineHandler = sinon.spy();
                var stream          = pipeline
                    .pipe(emitError, 'error text')
                    .on('error', pipelineHandler)
                    ()
                ;

                stream.on('error', streamHandler);
                stream.end({});

                process.nextTick(function () {
                    expect(pipelineHandler).to.have.been.calledOnce;
                    expect(streamHandler).not.to.have.been.called;
                    done();
                });
            });

            it('should not bubble errors that were handled in a multi-stage pipeline', function (done) {
                var streamHandler   = sinon.spy();
                var pipelineHandler = sinon.spy();
                var stream          = pipeline
                    .pipe(through.obj)
                    .pipe(emitError, 'error text')
                    .on('error', pipelineHandler)
                    ()
                ;

                stream.on('error', streamHandler);
                stream.end({});

                process.nextTick(function () {
                    expect(pipelineHandler).to.have.been.calledOnce;
                    expect(streamHandler).not.to.have.been.called;
                    done();
                });
            });

            it('should not bubble errors that were handled in a sub-pipeline', function (done) {
                var streamHandler   = sinon.spy();
                var pipelineHandler = sinon.spy();
                var stream          = pipeline
                    .pipe(labeledpipe()
                        .pipe(through.obj)
                        .pipe(emitError, 'error text')
                        .on('error', pipelineHandler)
                    )
                    ()
                ;

                stream.on('error', streamHandler);
                stream.end({});

                process.nextTick(function () {
                    expect(pipelineHandler).to.have.been.calledOnce;
                    expect(streamHandler).not.to.have.been.called;
                    done();
                });
            });

            it('should at least call the error handler when passed to a lazypipe', function (done) {
                var streamHandler   = sinon.spy();
                var pipelineHandler = sinon.spy();
                var stream          = lazypipe()
                    .pipe(pipeline
                        .pipe(emitError, 'error text')
                        .on('error', pipelineHandler)
                    )
                    ()
                ;

                stream.on('error', streamHandler);
                stream.end({});

                process.nextTick(function () {
                    expect(pipelineHandler).to.have.been.calledOnce;
                    // NOTE: stream handler still called due to the way lazypipes are constructed
                    expect(streamHandler).to.have.been.calledOnce;
                    done();
                });
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

        function eventSpy (method) {
            var stream    = through.obj();
            spies[method] = sinon.spy(stream, method);
            return stream;
        }

        function emitError (errorText) {
            return through.obj(function (obj, enc, done) {
                done(new Error(errorText));
            });
        }
    });
});
