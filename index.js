const pAny = require('p-any');
const net = require('net');
const _ = require('lodash');

const main = ['8.8.8.8:53', 'captive.apple.com', 'time.windows.com', 'google.com',];

const chinaMainLand = {special: ['114.114.114.114:53',], black: ['google.com']};
const russia = {special: ['yandex.ru',], black: []};
const egypt = {special: ['196.201.244.6:53',], black: []};

/**
 * @type {Map<string, {special:string[], black:string[]}>}
 */
const langSpecial = new Map();
langSpecial.set('zh', chinaMainLand);
langSpecial.set('zh-cn', chinaMainLand);
langSpecial.set('ru', russia);
langSpecial.set('ru-ru', russia);
langSpecial.set('ar-eg', egypt);

class NetTool {
    constructor(options) {
        this._language = '+';
        this.list = main;
        this.custom = {special: [], black: []};
        /**
         * @type {Map<string, Status>}
         */
        this.status = new Map();
        this.timeout = 1000;
        this.lastIsOnline = false;
        this.lastConnected = '';

        this.options = {};
        this.setOptions(options);
    }

    setOptions(options) {
        if (!options || 'object' !== typeof options) {
            return;
        }
        this.options = options;
        if (options.language) {
            this.language = options.language;
        }
        if (options.special) {
            this.addCustom('special', options.special);
        }
        if (options.black) {
            this.addCustom('black', options.black);
        }
    }

    set language(lang) {
        let old = this._language;
        this._language = lang.toLowerCase();
        if (old === lang && this.list.length > 0) {
            return;
        }
        this.genList();
    }

    genList() {
        if (!langSpecial.has(this._language)) {
            this.list = _.uniq(_.difference([...main, ...this.custom.special], this.custom.black));
            return;
        }
        this.list = _.uniq(_.difference([...main, ...langSpecial.get(this._language).special, ...this.custom.special], [...langSpecial.get(this._language).black, ...this.custom.black]));
    }

    /**
     * @param {string} type
     * @param {string|string[]} data
     */
    addCustom(type, data) {
        if (!data) return;
        if ('string' === typeof data) {
            this.custom[type].push(data);
        } else if ('object' === typeof data && data[0] && 'string' === typeof data[0]) {
            this.custom[type] = this.custom[type].concat(data);
        }
        this.genList();
    }

    /**
     * @param {Status} status
     */
    suggestBlackList(status) {
        if (0 === status.success && 3 < status.failed) {
            this.addCustom('black', status.source);
        }
    }

    check(source) {
        return new Promise((resolve, reject) => {
            let [host, port] = source.split(':');
            port = port ? port : '80';
            if (!this.status.get(source)) {
                this.status.set(source, new Status(source))
            }
            let status = this.status.get(source);
            let socket = new net.Socket();
            let start = new Date().getTime();
            let p = setTimeout(() => {
                status.checkFailed("connect timeout");
                this.suggestBlackList(status);
                socket.destroy();
                reject(status);
            }, this.timeout);
            socket.once('connect', () => {
                clearTimeout(p);
                status.checkSuccess(new Date().getTime() - start);
                socket.destroy();
                resolve(status);
            });
            socket.once('error', (e) => {
                clearTimeout(p);
                status.checkFailed(e.toString());
                this.suggestBlackList(status);
                socket.destroy();
                reject(status);
            });
            socket.connect(port, host);
        })
    }

    isOnline() {
        return new Promise(resolve => {
            let list = _.shuffle(this.list);
            if (this.lastIsOnline && this.lastConnected) {
                list = list.filter(s => s !== this.lastConnected);
            }
            list = _.take(list, 2);
            if (this.lastIsOnline && this.lastConnected) {
                list.push(this.lastConnected);
            }
            pAny(list.map(host => this.check(host)))
                .then((res) => {
                    this.lastConnected = res.source;
                    resolve(true)
                }, () => resolve(false))
        }).then(res => {
            this.lastIsOnline = res;
            return res
        })
    }

    async getStatus() {
        if (this.status.size >= this.list.length) {
            return this.status;
        }
        await Promise.all(this.list.map(host => this.check(host)))
            .then(() => true, () => false).catch(e => console.log(e));
        return this.status;
    }
}


class Status {
    constructor(source) {
        this.source = source;
        this.alive = false;
        this.time = -1;
        this.msg = '';
        this.failed = 0;
        this.success = 0;
    }

    get count() {
        return this.failed + this.success;
    }

    checkFailed(msg) {
        this.alive = false;
        this.time = -1;
        this.msg = msg;
        this.failed++;
    }

    checkSuccess(time) {
        this.alive = true;
        this.time = time;
        this.msg = '';
        this.success++;
    }

    toString() {
        return JSON.stringify(this);
    }
}


module.exports = {NetTool};
