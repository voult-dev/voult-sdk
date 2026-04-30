export class VoultClient {
    constructor(config) {
        this.baseURL = config.baseURL || 'https://api.voult.com';
        this.clientID = config.clientID;
        this.clientSecret = config.clientSecret;
        this.appId = config.appId;
    }
}
