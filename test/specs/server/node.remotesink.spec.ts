import { expect } from 'chai';
import 'mocha';
import { ModelBuilder } from '@openhps/core';
import { MQTTSourceNode } from '../../../src';

describe('node server', () => {
    describe('remote sink', () => {

        it('should throw an error when building without client service', (done) => {
            ModelBuilder.create()
                .from(new MQTTSourceNode({
                    uid: "source"
                }))
                .to()
                .build().then(model => {
                    done(`No error`);
                }).catch(ex => {
                    done();
                });
        });

    });
});