interface Logger {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
}
interface Config {
    autoConnect?: boolean;
    region: string;
    cognitoIdentityPoolId: string;
    iotEndpoint: string;
    clientId: string;
    logger?: Logger;
}
export default class AwsIotBrowserClient {
    constructor(config: Config);
    private authenticate;
    connect(): Promise<void>;
    disconnect(): Promise<unknown>;
    subscribe(topics: string[]): Promise<unknown>;
    unsubscribe(topics: string[]): Promise<unknown>;
    onConnect(callback: () => void): void;
    onReconnect(callback: () => void): void;
    onMessage(callback: (topic: string, payload: string) => void): void;
    publish(topic: string, payload: Object): Promise<unknown>;
}
export {};
