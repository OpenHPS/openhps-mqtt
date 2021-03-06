import { expect } from 'chai';
import 'mocha';
import { ModelBuilder, Model, DataFrame, DataObject, CallbackSinkNode, CallbackSourceNode } from '@openhps/core';
import { MQTTClient, MQTTServer, MQTTSinkNode, MQTTSourceNode } from '../../../src';

describe('node client', () => {
    describe('remote source', () => {

        it('should connect to a websocket server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from(new CallbackSourceNode(() => {
                    serverModel.emit('destroy');
                    clientModel.emit('destroy');
                    done();
                    return undefined;
                }))
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to()
                        .build().then(model => {
                            clientModel = model;
                            return clientModel.pull();
                        }).then(() => {
                            
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(50000);

        it('should forward server pushes to the client', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;
            
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from()
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to(new CallbackSinkNode(frame => {
                            serverModel.emit('destroy');
                            clientModel.emit('destroy');
                            done();
                        }))
                        .build().then(model => {
                            clientModel = model;
                            const frame = new DataFrame();
                            frame.addObject(new DataObject("abc"));
                            Promise.resolve(serverModel.push(frame));
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(50000);

        it('should forward client errors to the server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;
            
            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from()
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to(new CallbackSinkNode(frame => {
                            throw new Error(`Client Error`);
                        }))
                        .build().then(model => {
                            clientModel = model;
                            const frame = new DataFrame();
                            frame.addObject(new DataObject("abc"));
                            serverModel.once('error', err => {
                                serverModel.emit('destroy');
                                clientModel.emit('destroy');
                                done();
                            });
                            serverModel.push(frame);
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(50000);

        it('should forward client completed events to the server', (done) => {
            let clientModel: Model<any, any>;
            let serverModel: Model<any, any>;

            ModelBuilder.create()
                .addService(new MQTTServer({
                    port: 1443
                }))
                .from()
                .to(new MQTTSinkNode({
                    uid: "sink"
                }))
                .build().then(model => {
                    serverModel = model;
                    ModelBuilder.create()
                        .addService(new MQTTClient({
                            url: 'mqtt://localhost:1443',
                        }))
                        .from(new MQTTSourceNode({
                            uid: "sink"
                        }))
                        .to(new CallbackSinkNode())
                        .build().then(model => {
                            clientModel = model;
                            const frame = new DataFrame();
                            frame.addObject(new DataObject("abc"));
                            serverModel.push(frame);
                            serverModel.once('completed', event => {
                                // Completed locally
                                serverModel.once('completed', event => {
                                    // Completed on remote server
                                    serverModel.emit('destroy');
                                    clientModel.emit('destroy');
                                    done();
                                });
                            });
                        }).catch(ex => {
                            done(ex);
                        });
                }).catch(ex => {
                    done(ex);
                });
        }).timeout(50000);
        
    });
});