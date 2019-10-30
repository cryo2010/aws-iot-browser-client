"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const aws_iot_device_sdk_1 = __importDefault(require("aws-iot-device-sdk"));
const deviceMap = new WeakMap();
const configMap = new WeakMap();
const nullLogger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
};
function getConfig(client) {
    const config = configMap.get(client);
    if (!config) {
        throw new Error('config does not exist');
    }
    return config;
}
function configureAws(region, cognitoIdentityPoolId) {
    aws_sdk_1.default.config.region = region;
    aws_sdk_1.default.config.credentials = new aws_sdk_1.default.CognitoIdentityCredentials({
        IdentityPoolId: cognitoIdentityPoolId,
    });
}
class AwsIotBrowserClient {
    constructor(config) {
        const logger = config.logger || nullLogger;
        configMap.set(this, { ...config, logger });
        configureAws(config.region, config.cognitoIdentityPoolId);
        const device = new aws_iot_device_sdk_1.default.device({
            region: config.region,
            host: config.iotEndpoint,
            clientId: config.clientId,
            protocol: 'wss',
            maximumReconnectTimeMs: 5000,
            accessKeyId: '',
            secretKey: '',
            sessionToken: '',
        });
        deviceMap.set(this, device);
        if (config.autoConnect || config.autoConnect === undefined) {
            this.connect();
        }
    }
    authenticate() {
        const { logger } = getConfig(this);
        const device = deviceMap.get(this);
        return new Promise(async (resolve, reject) => {
            const identity = new aws_sdk_1.default.CognitoIdentity();
            const creds = aws_sdk_1.default.config.credentials;
            creds.get(function (err) {
                if (err) {
                    logger.error('failed to retrieve AWS Cognito identity');
                    logger.error(err);
                    return reject(err);
                }
                const params = { IdentityId: creds.identityId };
                identity.getCredentialsForIdentity(params, (err, data) => {
                    if (err) {
                        logger.error(`error retrieving credentials (${err.message})`);
                        return reject(err);
                    }
                    device.updateWebSocketCredentials(data.Credentials.AccessKeyId, data.Credentials.SecretKey, data.Credentials.SessionToken);
                    resolve();
                });
            });
        });
    }
    async connect() {
        const { logger } = getConfig(this);
        await this.authenticate();
        logger.info('connected');
    }
    disconnect() {
        const { logger } = getConfig(this);
        logger.info('disconnecting');
        return new Promise((resolve, reject) => {
            const device = deviceMap.get(this);
            device.end(() => {
                logger.info('disconnected');
                return resolve();
            });
        });
    }
    subscribe(topics) {
        const { logger } = getConfig(this);
        logger.info(`subscribing to ${topics.length} topics (${topics.join(', ')})`);
        return new Promise((resolve, reject) => {
            const device = deviceMap.get(this);
            device.subscribe(topics, (err) => {
                if (err) {
                    logger.error(`failed to subscribe ${err.message}`);
                    return reject(err);
                }
                return resolve();
            });
        });
    }
    unsubscribe(topics) {
        const { logger } = getConfig(this);
        logger.info(`unsubscribing from ${topics.length} topics (${topics.join(', ')})`);
        return new Promise((resolve, reject) => {
            const device = deviceMap.get(this);
            device.unsubscribe(topics, (err) => {
                if (err) {
                    logger.error(`failed to unsubscribe ${err.message}`);
                    return reject(err);
                }
                return resolve();
            });
        });
    }
    onConnect(callback) {
        const device = deviceMap.get(this);
        device.on('connect', callback);
    }
    onReconnect(callback) {
        const device = deviceMap.get(this);
        device.on('reconnect', callback);
    }
    onMessage(callback) {
        const { logger } = getConfig(this);
        const device = deviceMap.get(this);
        device.on('message', (topic, payload) => {
            logger.debug(`recieved message (topic=${topic}, payload=${JSON.stringify(payload)})`);
            callback(topic, payload);
        });
    }
    publish(topic, payload) {
        const { logger } = getConfig(this);
        const device = deviceMap.get(this);
        return new Promise((resolve, reject) => {
            logger.debug(`publishing to topic "${topic}" (${payload.toString()})`);
            device.publish(topic, payload, (err) => {
                if (err) {
                    logger.error(`failed to publish event to topic "${topic}" (${payload.toString()})`);
                    return reject(err);
                }
                return resolve();
            });
        });
    }
}
exports.default = AwsIotBrowserClient;
