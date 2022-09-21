import { RemotePushOptions } from '@openhps/core';

export interface MQTTPushOptions extends RemotePushOptions {
    topic: string;
}
