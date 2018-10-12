'use strict';

/* eslint-disable no-unused-expressions */

const chai = require('chai');
const {beforeEach, describe, it} = require(`mocha`);
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const through = require('through2');
const lazypipe = require('lazypipe');
const labeledpipe = require('./index');

chai.use(sinonChai);
const {expect} = chai;

describe('labeledpipe', () => {
  it('should be a function', () => {
    expect(labeledpipe).to.be.a('function');
  });

  it('should provide access to the LabeledPipe constructor', () => {
    expect(labeledpipe).to.have.property('LabeledPipe').to.be.a('function');
  });

  describe('()', () => {
    let pipeline;
    beforeEach(() => {
      pipeline = labeledpipe('testDisplayName');
    });

    it('should create a function', () => {
      expect(pipeline).to.be.a('function');
    });

    it('should set a display name on the build function', () => {
      expect(pipeline).to.have.property('displayName').to.equal('testDisplayName');
    });

    it('should build a steam', () => {
      const stream = pipeline();
      expect(stream).to.have.property('writable').to.be.true;
      expect(stream).to.have.property('readable').to.be.true;
      expect(stream).to.have.property('write').to.be.a('function');
      expect(stream).to.have.property('push').to.be.a('function');
    });

    it('should have the labeledpipe API', () => {
      expect(pipeline).to.have.property('pipe').to.be.a('function');
      expect(pipeline).to.have.property('before').to.be.a('function');
      expect(pipeline).to.have.property('after').to.be.a('function');
      expect(pipeline).to.have.property('remove').to.be.a('function');
      expect(pipeline).to.have.property('first').to.be.a('function');
      expect(pipeline).to.have.property('last').to.be.a('function');
      expect(pipeline).to.have.property('appendStepsTo').to.be.a('function');

      labeledpipe.LabeledPipe.CHAINABLE_EVENT_EMITTER_METHODS.forEach(method => {
        expect(pipeline).to.have.property(method).to.be.a('function');
      });
    });

    let builtStreams;
    let pipelineEvents;
    let spies;
    beforeEach(() => {
      builtStreams = [];
      pipelineEvents = [];
      spies = {};
    });

    describe('.pipe', () => {
      it('should return a new pipeline', () => {
        expect(pipeline.pipe(reportStage)).not.to.equal(pipeline);
      });

      it('should not build the new stream', () => {
        pipeline.pipe(reportStage, 'A');

        expect(builtStreams).to.deep.equal([]);
        expect(pipelineEvents).to.deep.equal([]);
      });

      it('should add a stream that is build with the pipeline', () => {
        pipeline = pipeline.pipe(reportStage, 'A');
        pipeline();
        expect(builtStreams).to.deep.equal(['A']);
        expect(pipelineEvents).to.deep.equal([]);
      });

      it('should pipe objects to the added stream', () => {
        pipeline = pipeline.pipe(reportStage, 'A');
        const stream = pipeline();

        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A']);
      });

      it('should allow adding markers', () => {
        pipeline = pipeline
          .pipe(reportStage, 'A')
          .pipe('B');
        pipeline();
        expect(builtStreams).to.deep.equal(['A']);
        expect(pipelineEvents).to.deep.equal([]);
      });

      it('should allow piping to labeledpipe', () => {
        const other = labeledpipe().pipe(reportStage, 'A');
        pipeline = pipeline.pipe(other);
        const stream = pipeline();

        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A']);
      });

      it('should allow piping to lazypipe', () => {
        const other = lazypipe().pipe(reportStage, 'A');
        pipeline = pipeline.pipe(other);
        const stream = pipeline();

        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A']);
      });

      it('should allow piping from lazypipe', () => {
        pipeline = pipeline.pipe(reportStage, 'A');
        const other = lazypipe().pipe(pipeline);
        const stream = other();

        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A']);
      });
    });

    describe('.before', () => {
      it('should change the append location to before label', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .before('A')
          .pipe('C', reportStage, 'C')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['C', 'D', 'A', 'B']);
      });

      it('should change the append location to before label in sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe(other)
          .before('C')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'B', 'D', 'C']);
      });

      it('should change the append location to before label sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('other', other)
          .pipe('D', reportStage, 'D')
          .before('other')
          .pipe('E', reportStage, 'E');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'E', 'B', 'C', 'D']);
      });

      it('should throw an error if the label doesn\'t exist', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B');
        function removeC() {
          pipeline = pipeline.before('C');
        }

        expect(removeC).to.throw(Error, 'Unable to move cursor before step C');
      });
    });

    describe('.after', () => {
      it('should change the append location to after label', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .after('A')
          .pipe('C', reportStage, 'C')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'C', 'D', 'B']);
      });

      it('should change the append location to after label in sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe(other)
          .after('B')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'B', 'D', 'C']);
      });

      it('should change the append location to after label sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('other', other)
          .pipe('D', reportStage, 'D')
          .after('other')
          .pipe('E', reportStage, 'E');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'B', 'C', 'E', 'D']);
      });

      it('should throw an error if the label doesn\'t exist', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B');
        function removeC() {
          pipeline = pipeline.after('C');
        }

        expect(removeC).to.throw(Error, 'Unable to move cursor after step C');
      });
    });

    describe('.beginningOf', () => {
      it('should change the append location to after beginning of a marker', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('MissingLetters')
          .pipe('B', reportStage, 'B')

          .beginningOf('MissingLetters')
          .pipe('Y', reportStage, 'Y')
          .beginningOf('MissingLetters')
          .pipe('X', reportStage, 'X');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'X', 'Y', 'B']);
      });

      it('should change the append location to after beginning of a sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('OtherThings', other)
          .pipe('D', reportStage, 'D')
          .beginningOf('OtherThings')
          .pipe('X', reportStage, 'X');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'X', 'B', 'C', 'D']);
      });
    });

    describe('.endOf', () => {
      it('should change the append location to before end of a marker', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('MissingLetters')
          .pipe('B', reportStage, 'B')

          .endOf('MissingLetters')
          .pipe('X', reportStage, 'X');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'X', 'B']);
      });

      it('should change the append location to before end of a sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('OtherThings', other)
          .pipe('D', reportStage, 'D')

          .endOf('OtherThings')
          .pipe('X', reportStage, 'X');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'B', 'C', 'X', 'D']);
      });
    });

    describe('.remove', () => {
      it('should be able to remove step from pipeline', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .remove('B');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'C']);
      });

      it('should be able to remove step from sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe(other)
          .remove('B');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'C']);
      });

      it('should be able to remove sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('other', other)
          .pipe('D', reportStage, 'D')
          .remove('other');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'D']);
      });

      it('should not change cursor position if cursor is before removed stream', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .before('A')
          .remove('B')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['D', 'A', 'C']);
      });

      it('should change cursor position if cursor is after removed stream', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .after('B')
          .remove('B')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'D', 'C']);
      });

      it('should change cursor position if cursor inside remove stream', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('other', other)
          .pipe('D', reportStage, 'D')
          .after('B')
          .remove('other')
          .pipe('E', reportStage, 'E');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'E', 'D']);
      });

      it('should throw an error if the label doesn\'t exist', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B');
        function removeC() {
          pipeline = pipeline.remove('C');
        }

        expect(removeC).to.throw(Error, 'Unable to remove step C');
      });
    });

    describe('.replace', () => {
      it('should be able to repalce step in a pipeline', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .replace('B', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'D', 'C']);
      });

      it('should be able to replace a step in a sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe(other)
          .replace('B', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'D', 'C']);
      });

      it('should be able to replace a sub-pipeline', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('other', other)
          .pipe('D', reportStage, 'D')
          .replace('other', reportStage, 'E');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'E', 'D']);
      });

      it('should not change cursor position if cursor is before replaced stream', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .before('A')
          .replace('B', reportStage, 'E')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['D', 'A', 'E', 'C']);
      });

      it('should change cursor position if cursor is after replaced stream', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .after('B')
          .replace('B', reportStage, 'E')
          .pipe('D', reportStage, 'D');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'E', 'D', 'C']);
      });

      it('should change cursor position if cursor inside remove stream', () => {
        const other = labeledpipe()
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('other', other)
          .pipe('D', reportStage, 'D')
          .after('B')
          .replace('other', reportStage, 'F')
          .pipe('E', reportStage, 'E');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'F', 'E', 'D']);
      });

      it('should throw an error if the label doesn\'t exist', () => {
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B');
        function removeC() {
          pipeline = pipeline.replace('C', reportStage, 'D');
        }

        expect(removeC).to.throw(Error, 'Unable to remove step C');
      });

      it('should allow replacing with a labeledpipe', () => {
        const other = labeledpipe().pipe(reportStage, 'D');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .replace('B', other);
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'D', 'C']);
      });

      it('should allow replacing with a lazypipe', () => {
        const other = lazypipe().pipe(reportStage, 'D');
        pipeline = pipeline
          .pipe('A', reportStage, 'A')
          .pipe('B', reportStage, 'B')
          .pipe('C', reportStage, 'C')
          .replace('B', other);
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['A', 'D', 'C']);
      });
    });

    describe('.first', () => {
      it('should change the append location to the beginning', () => {
        pipeline = pipeline
          .pipe(reportStage, 'A')
          .first()
          .pipe(reportStage, 'B')
          .pipe(reportStage, 'C');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['B', 'C', 'A']);
      });
    });

    describe('.last', () => {
      it('should change the append location to the end', () => {
        pipeline = pipeline
          .pipe(reportStage, 'A')
          .first()
          .pipe(reportStage, 'B')
          .last()
          .pipe(reportStage, 'C');
        const stream = pipeline();
        stream.end({});
        expect(pipelineEvents).to.deep.equal(['B', 'A', 'C']);
      });
    });

    const eventArgs = {
      addListener: ['event', function () {}],
      on: ['event', function () {}],
      once: ['event', function () {}],
      removeListener: ['event', function () {}],
      removeAllListeners: ['event'],
      setMaxListeners: [10],
    };

    Object
      .keys(eventArgs)
      .forEach(method => {
        describe('.' + method, () => {
          it('should proxy to pipeline stage under the cursor', () => {
            pipeline = pipeline.pipe(eventSpy, method);
            pipeline = pipeline[method](...eventArgs[method]);

            expect(spies[method]).to.be.undefined;

            const stream = pipeline();
            expect(spies[method]).to.have.been.calledWith(eventArgs[method][0]);
            stream.end();
          });

          it('should throw an error if there isn\'t a task under the cursor', () => {
            expect(pipeline[method]).to.throw('No event emitter under cursor');
          });

          it('should handle events when passed to a lazypipe', () => {
            pipeline = pipeline.pipe(eventSpy, method);
            pipeline = pipeline[method](...eventArgs[method]);
            expect(spies[method]).to.be.undefined;

            const stream = lazypipe().pipe(pipeline)();
            expect(spies[method]).to.have.been.calledWith(eventArgs[method][0]);
            stream.end();
          });
        });
      });
    describe('error handling', () => {
      it('should bubble errors from pipeline to stream', done => {
        const handler = sinon.spy();
        const stream = pipeline
          .pipe(emitError, 'error text')();
        stream.on('error', handler);
        stream.end({});

        process.nextTick(() => {
          expect(handler).to.have.been.calledOnce;
          done();
        });
      });

      it('should not bubble errors that were handled in a single stage pipeline', done => {
        const streamHandler = sinon.spy();
        const pipelineHandler = sinon.spy();
        const stream = pipeline
          .pipe(emitError, 'error text')
          .on('error', pipelineHandler)();
        stream.on('error', streamHandler);
        stream.end({});

        process.nextTick(() => {
          expect(pipelineHandler).to.have.been.calledOnce;
          expect(streamHandler).not.to.have.been.called;
          done();
        });
      });

      it('should not bubble errors that were handled in a multi-stage pipeline', done => {
        const streamHandler = sinon.spy();
        const pipelineHandler = sinon.spy();
        const stream = pipeline
          .pipe(through.obj)
          .pipe(emitError, 'error text')
          .on('error', pipelineHandler)();
        stream.on('error', streamHandler);
        stream.end({});

        process.nextTick(() => {
          expect(pipelineHandler).to.have.been.calledOnce;
          expect(streamHandler).not.to.have.been.called;
          done();
        });
      });

      it('should not bubble errors that were handled in a sub-pipeline', done => {
        const streamHandler = sinon.spy();
        const pipelineHandler = sinon.spy();
        const stream = pipeline
          .pipe(labeledpipe()
            .pipe(through.obj)
            .pipe(emitError, 'error text')
            .on('error', pipelineHandler)
          )();
        stream.on('error', streamHandler);
        stream.end({});

        process.nextTick(() => {
          expect(pipelineHandler).to.have.been.calledOnce;
          expect(streamHandler).not.to.have.been.called;
          done();
        });
      });

      it('should at least call the error handler when passed to a lazypipe', done => {
        const streamHandler = sinon.spy();
        const pipelineHandler = sinon.spy();
        const stream = lazypipe()
          .pipe(pipeline
            .pipe(emitError, 'error text')
            .on('error', pipelineHandler)
          )();
        stream.on('error', streamHandler);
        stream.end({});

        process.nextTick(() => {
          expect(pipelineHandler).to.have.been.calledOnce;
          // NOTE: stream handler still called due to the way lazypipes are constructed
          expect(streamHandler).to.have.been.calledOnce;
          done();
        });
      });
    });

    function reportStage(label) {
      builtStreams.push(label);

      return through.obj(transform);
      function transform(file, enc, done) {
        pipelineEvents.push(label);
        done(null, file);
      }
    }

    function eventSpy(method) {
      const stream = through.obj();
      spies[method] = sinon.spy(stream, method);
      return stream;
    }

    function emitError(errorText) {
      return through.obj((obj, enc, done) => {
        done(new Error(errorText));
      });
    }
  });
});
