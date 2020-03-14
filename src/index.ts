import CognitoIdentity from "aws-sdk/clients/cognitoidentity";
import AWS, { AWSError } from "aws-sdk/global";
import awsIot from "aws-iot-device-sdk";

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

interface FullConfig extends Config {
  logger: Logger;
}

const deviceMap = new WeakMap<AwsIotBrowserClient, any>();
const configMap = new WeakMap<AwsIotBrowserClient, FullConfig>();

const nullLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

function getConfig(client: AwsIotBrowserClient): FullConfig {
  const config = configMap.get(client);
  if (!config) {
    throw new Error("config does not exist");
  }
  return config;
}

function configureAws(region: string, cognitoIdentityPoolId: string) {
  AWS.config.region = region;
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: cognitoIdentityPoolId
  });
}

export default class AwsIotBrowserClient {
  constructor(config: Config) {
    const logger = config.logger || nullLogger;
    configMap.set(this, { ...config, logger });
    configureAws(config.region, config.cognitoIdentityPoolId);
    const device = new awsIot.device({
      region: config.region,
      host: config.iotEndpoint,
      clientId: config.clientId,
      protocol: "wss",
      maximumReconnectTimeMs: 5000,
      accessKeyId: "",
      secretKey: "",
      sessionToken: ""
    });
    deviceMap.set(this, device);
    if (config.autoConnect || config.autoConnect === undefined) {
      this.connect();
    }
  }

  private authenticate() {
    const { logger } = getConfig(this);
    const device = deviceMap.get(this);
    return new Promise(async (resolve, reject) => {
      const identity = new CognitoIdentity();
      const creds = AWS.config.credentials as any;
      creds.get(function(err: AWSError) {
        if (err) {
          logger.error("failed to retrieve AWS Cognito identity");
          logger.error(err);
          return reject(err);
        }
        const params = { IdentityId: creds.identityId };
        identity.getCredentialsForIdentity(params, (err: any, data: any) => {
          if (err) {
            logger.error(`error retrieving credentials (${err.message})`);
            return reject(err);
          }
          device.updateWebSocketCredentials(
            data.Credentials.AccessKeyId,
            data.Credentials.SecretKey,
            data.Credentials.SessionToken
          );
          resolve();
        });
      });
    });
  }

  public async connect() {
    const { logger } = getConfig(this);
    await this.authenticate();
    logger.info("connected");
  }

  public disconnect() {
    const { logger } = getConfig(this);
    logger.info("disconnecting");
    return new Promise((resolve, reject) => {
      const device = deviceMap.get(this);
      device.end(() => {
        logger.info("disconnected");
        return resolve();
      });
    });
  }

  public subscribe(topics: string[]) {
    const { logger } = getConfig(this);
    logger.info(
      `subscribing to ${topics.length} topics (${topics.join(", ")})`
    );
    return new Promise((resolve, reject) => {
      const device = deviceMap.get(this);
      device.subscribe(topics, (err: any) => {
        if (err) {
          logger.error(`failed to subscribe ${err.message}`);
          return reject(err);
        }
        return resolve();
      });
    });
  }

  public unsubscribe(topics: string[]) {
    const { logger } = getConfig(this);
    logger.info(
      `unsubscribing from ${topics.length} topics (${topics.join(", ")})`
    );
    return new Promise((resolve, reject) => {
      const device = deviceMap.get(this);
      device.unsubscribe(topics, (err: any) => {
        if (err) {
          logger.error(`failed to unsubscribe ${err.message}`);
          return reject(err);
        }
        return resolve();
      });
    });
  }

  public onConnect(callback: () => void) {
    const device = deviceMap.get(this);
    device.on("connect", callback);
  }

  public onReconnect(callback: () => void) {
    const device = deviceMap.get(this);
    device.on("reconnect", callback);
  }

  public onMessage(callback: (topic: string, payload: string) => void) {
    const { logger } = getConfig(this);
    const device = deviceMap.get(this);
    device.on("message", (topic: string, payload: string) => {
      logger.debug(`recieved message (topic=${topic}, payload=${payload})`);
      callback(topic, payload);
    });
  }

  public publish(topic: string, payload: Object) {
    const { logger } = getConfig(this);
    const device = deviceMap.get(this);
    return new Promise((resolve, reject) => {
      logger.debug(`publishing to topic "${topic}" (${payload.toString()})`);
      device.publish(topic, payload, (err: any) => {
        if (err) {
          logger.error(
            `failed to publish event to topic "${topic}" (${payload.toString()})`
          );
          return reject(err);
        }
        return resolve();
      });
    });
  }
}
