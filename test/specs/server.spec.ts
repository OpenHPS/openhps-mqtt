import { CallbackSinkNode, GraphBuilder, Model, ModelBuilder } from '@openhps/core';
import { MQTTServer, MQTTSinkNode, MQTTSourceNode } from '../../src';
import 'mocha';

describe('MQTTServer', () => {
    let model: Model;
    let callbackNode: CallbackSinkNode<any>;

    before((done) => {
        callbackNode = new CallbackSinkNode();
        ModelBuilder.create()
            .addService(new MQTTServer({
                port: 1444,
            }))
            .addShape(GraphBuilder.create()
                .from("in")
                .to(new MQTTSinkNode({
                    uid: "1"
                })))
            .addShape(GraphBuilder.create()
                .from(new MQTTSourceNode({
                    uid: "2"
                }))
                .to(callbackNode))
            .build().then(m => {
                model = m;
                done();
            });
    });

    it('should support pushing to the MQTT ', () => {
        
    });

});
