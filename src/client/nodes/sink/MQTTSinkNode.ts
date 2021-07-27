import { DataFrame, RemoteSinkNode, SinkNodeOptions } from '@openhps/core';
import { MQTTClient } from '../../service/MQTTClient';

export class MQTTSinkNode<In extends DataFrame> extends RemoteSinkNode<In, MQTTClient> {
    constructor(options?: SinkNodeOptions) {
        super({ service: MQTTClient, ...options });
    }
}
