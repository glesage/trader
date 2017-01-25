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
    self.recordTraderData = recordTraderData;
    self.getLastTraderData = getLastTraderData;
    return self;

    /* Public */
    function recordTraderData(traderData)
    {
        // Insert into DB when ready
        return checkReady().then(function ()
        {
            return insertPromise('traderData', traderData);
        });
    }

    function getLastTraderData()
    {
        return checkReady().then(function ()
        {
            return findPromise('traderData', null, ['timestamp'], 1).then(function (dataBackup)
            {
                if (!dataBackup || !dataBackup.length) return null;
                return dataBackup[0];
            }).catch(function (err)
            {
                console.log("Error getting backup data");
                console.log(err);
                return null;
            });
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

    function findPromise(collectionName, query, sortProperties, limit)
    {
        var collection = db.collection(collectionName);
        if (!collection) return Promise.reject(noCollectionError(collectionName));

        return new Promise(function (resolve, reject)
        {
            var find = collection.find(query);

            // Sort by provided properties
            if (sortProperties && sortProperties.length)
            {
                var sortingArray = [];
                sortProperties.forEach(function (s)
                {
                    sortingArray.push(s);
                    sortingArray.push(1);
                });

                find = find.sort([sortingArray]);
            }

            // Limit to provided limit
            if (limit > 0) find = find.limit(limit);

            find.toArray(function (err, result)
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
        });
    }
};
