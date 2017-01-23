/* Dependencies */
var GoogleSpreadsheet = require("google-sheets-node-api");

//Main export
module.exports = function (SHEETS_ID, SHEETS_CREDS)
{
    var self = this;
    self.recordTrade = recordTrade;
    self.updateTraderData = updateTraderData;

    var mySheet = new GoogleSpreadsheet(SHEETS_ID);
    return self;

    /* Public */
    function recordTrade(trade)
    {
        if (parseFloat(trade.amount) < 0) trade.type = 'sell';
        if (parseFloat(trade.amount) > 0) trade.type = 'buy';

        return checkReady().then(function ()
        {
            var worksheet = getWorksheet('trades');
            if (!worksheet) noWorkSheetError('trades');
            return worksheet.addRow(trade);
        });
    }

    function updateTraderData(data)
    {
        if (!data) return Promise.reject(new Error('Data must be specified'));
        if (!data.timestamp) return Promise.reject(new Error('Data must have timestamp specified'));
        if (!data.average) return Promise.reject(new Error('Data must have average specified'));
        if (!data.support) return Promise.reject(new Error('Data must have support specified'));
        if (!data.resistance) return Promise.reject(new Error('Data must have resistance specified'));

        return checkReady().then(function ()
        {
            var worksheet = getWorksheet('trader');
            if (!worksheet) noWorkSheetError('trader');
            return worksheet.addRow(data);
        });
    }

    /* Private */
    function getWorksheet(type)
    {
        if (!mySheet.sheetInfo || !mySheet.sheetInfo.worksheets || !mySheet.sheetInfo.worksheets.length) return null;
        var ws = mySheet.sheetInfo.worksheets.find(function (ws)
        {
            return ws.title.toLowerCase() === type.toLowerCase();
        });
        return ws;
    }

    function noWorkSheetError(name)
    {
        var unsupported = new Error('Unable to find ' + name + ' worksheet');
        unsupported.type = 'unsupported';
        unsupported.code = 404;
        throw unsupported;
    }

    function checkReady()
    {
        if (!self.ready || !mySheet.sheetInfo) return authenticate();
        else return Promise.resolve(mySheet);
    }

    function authenticate()
    {
        return mySheet.useServiceAccountAuth(SHEETS_CREDS).then(function (res)
        {
            return mySheet.getSpreadsheet();
        }).then(function (sheetInfo)
        {
            mySheet.sheetInfo = sheetInfo;
            self.ready = true;
        });
    }
};
