import { expect } from 'chai';
import 'mocha';
import { ModelBuilder, Model, DataFrame, DataObject, CallbackSinkNode, CallbackSourceNode } from '@openhps/core';
import { MQTTClient, MQTTServer, MQTTSinkNode, MQTTSourceNode } from '../../../src';

describe('node client', () => {
    describe('remote sink', () => {

        it('should build a model without connecting', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;
            
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,
                    websocket: true
                }))
                .from(new MQTTSourceNode({
                    uid: "source"
                }))
                .to(new CallbackSinkNode((frame: DataFrame) => {

                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: "mqtt://localhost:1443",
                        }))
                        .from()
                        .to(new MQTTSinkNode({
                            uid: "source"
                        }))
                        .build().then(model => {
                            clientModel = model;
                            const frame = new DataFrame();
                            frame.addObject(new DataObject("abc"));
                            model.push(frame);
                            serverModel.emit('destroy');
                            clientModel.emit('destroy');
                            done();
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(50000);

        it('should connect to a websocket server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;
            
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443,
                    websocket: true,
                }))
                .withLogger(console.log)
                .from(new MQTTSourceNode({
                    uid: "source"
                }))
                .to(new CallbackSinkNode((frame: DataFrame) => {
                    expect(frame.getObjects()[0].uid).to.equal("abc");
                    clientModel.emit('destroy');
                    serverModel.emit('destroy');
                    done();
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: "ws://localhost:1443",
                        }))
                        .from()
                        .to(new MQTTSinkNode({
                            uid: "source"
                        }))
                        .build().then(model => {
                            setTimeout(() => {
                                clientModel = model;
                                const frame = new DataFrame();
                                frame.addObject(new DataObject("abc"));
                                clientModel.push(frame);
                            }, 1000);
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(50000);

        it('should forward server pulls to the client', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from(new MQTTSourceNode({
                    uid: "source"
                }))
                .to()
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: "mqtt://localhost:1443",
                        }))
                        .from(new CallbackSourceNode(() => {
                            serverModel.emit('destroy');
                            clientModel.emit('destroy');
                            done();
                            return null;
                        }))
                        .to(new MQTTSinkNode({
                            uid: "source"
                        }))
                        .build().then(model => {
                            clientModel = model;
                            Promise.resolve(serverModel.pull());
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(5000);
    });
});