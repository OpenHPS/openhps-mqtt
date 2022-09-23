import { NodeOptions } from '@openhps/core';

export interface MQTTNodeOptions extends NodeOptions {
    topic?: {
        push: string;
        pull: string;
        event: string;
    };
}
