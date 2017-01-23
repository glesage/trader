/* Dependencies */
var MongoClient = require('mongodb').MongoClient;

/**
 * DB responsible for storing & finding trades in the DB
 *
 * takes the db url for mongo
 */
module.exports = function (dbURL)
{
    var db = null;
    startDB(dbURL);

    var self = this;
    self.recordTrade = recordTrade;
    self.recordTraderData = recordTraderData;
    return self;

    /* Public */
    function recordTrade(trade)
    {
        // Add type proerty
        if (parseFloat(trade.amount) < 0) trade.type = 'sell';
        if (parseFloat(trade.amount) > 0) trade.type = 'buy';

        // Delete unused property
        delete trade.seq;

        // Insert into DB when ready    
        return checkReady().then(function ()
        {
            return insertPromise('trades', trade);
        });
    }

    function recordTraderData(traderData)
    {
        // Insert into DB when ready
        return checkReady().then(function ()
        {
            return insertPromise('traderData', traderData);
        });
    }

    function getTraderData(query)
    {
        if (query === undefined) query = {};
        if (query === null) query = {};

        return checkReady().then(function ()
        {
            return findPromise('trades', query);
        });
    }


    /* Private */
    function startDB(url)
    {
        MongoClient.connect(url, function (err, theDB)
        {
            if (err) return console.log(err);
            db = theDB;
        });
    }

    function insertPromise(collectionName, data)
    {
        var collection = db.collection(collectionName);
        if (!collection) return Promise.reject(noCollectionError(collectionName));

        return new Promise(function (resolve, reject)
        {
            collection.insert(data, function (err, result)
            {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    function findPromise(collectionName, query)
    {
        var collection = db.collection(collectionName);
        if (!collection) return Promise.reject(noCollectionError(collectionName));

        return new Promise(function (resolve, reject)
        {
            collection.find(query).toArray(function (err, result)
            {
                if (err) return reject(err);
                resolve(result);
            });
        });
    }

    function noCollectionError(name)
    {
        var unsupported = new Error('Unable to find ' + name + ' mongo collection');
        unsupported.type = 'unsupported';
        unsupported.code = 404;
        return unsupported;
    }

    function checkReady()
    {
        if (!db) return wait500ms().then(checkReady);
        return Promise.resolve();
    }

    function wait500ms()
    {
        return new Promise(function (resolve, reject)
        {
            setTimeout(function ()
            {
                resolve();
            }, 500);
        })
    }
};
