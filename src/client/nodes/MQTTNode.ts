import { DataFrame, DataSerializer, Node, RemoteNode } from '@openhps/core';
import { MQTTPushOptions } from './MQTTPushOptions';
import { MQTTClient } from '../service/MQTTClient';
import { MQTTNodeOptions } from './MQTTNodeOptions';

export class MQTTNode<In extends DataFrame, Out extends DataFrame> extends RemoteNode<In, Out, MQTTClient> {
    protected options: MQTTNodeOptions<MQTTClient>;

    constructor(options?: MQTTNodeOptions<MQTTClient>, node?: Node<any, any>) {
        super({ service: MQTTClient, ...options }, node);
        this.options.serialize =
            options.serialize ??
            ((object: DataFrame, options?: MQTTPushOptions) => {
                return {
                    frame: DataSerializer.serialize(object),
                    options,
                };
            });
        this.options.deserialize =
            options.deserialize ??
            ((msg: any) => {
                return DataSerializer.deserialize(msg.frame);
            });
    }
}
