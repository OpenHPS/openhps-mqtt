import { DataFrame, RemoteSourceNode, RemoteSourceNodeOptions } from '@openhps/core';
import { MQTTNodeOptions } from '../MQTTNodeOptions';
import { MQTTClient } from '../../service/MQTTClient';
import { MQTTNode } from '../MQTTNode';

export class MQTTSourceNode<Out extends DataFrame> extends RemoteSourceNode<Out, MQTTClient, MQTTNode<Out, Out>> {
    constructor(options?: RemoteSourceNodeOptions<MQTTClient> & MQTTNodeOptions<MQTTClient>) {
        super({ service: MQTTClient, type: MQTTNode, ...options });
    }
}
