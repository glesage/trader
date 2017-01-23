/* Dependencies */
var GoogleSpreadsheet = require("google-sheets-node-api");

/**
 * Sheets responsible for displaying data on google drive sheets
 * mostly for logging & monitoring purposes
 *
 * Takes a Sheet ID and credentials string
 */
module.exports = function (SHEETS_ID, SHEETS_CREDS)
{
    var mySheet = new GoogleSpreadsheet(SHEETS_ID);

    var self = this;
    self.recordMyTrade = recordMyTrade;
    self.recordAllTrade = recordAllTrade;
    self.recordTraderData = recordTraderData;
    return self;

    /* Public */
    function recordMyTrade(trade)
    {
        return checkReady().then(function ()
        {
            var worksheet = getWorksheet('my_trades');
            if (!worksheet) noWorkSheetError('my_trades');
            return worksheet.addRow(trade);
        });
    }

    function recordAllTrade(trade)
    {
        return checkReady().then(function ()
        {
            var worksheet = getWorksheet('all_trades');
            if (!worksheet) noWorkSheetError('all_trades');
            return worksheet.addRow(trade);
        });
    }

    function recordTrade(trade)
    {
        return checkReady().then(function ()
        {
            var worksheet = getWorksheet('trades');
            if (!worksheet) noWorkSheetError('trades');
            return worksheet.addRow(trade);
        });
    }

    function recordTraderData(data)
    {
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
        return mySheet.useServiceAccountAuth(JSON.parse(SHEETS_CREDS))
            .then(function (res)
            {
                return mySheet.getSpreadsheet();
            }).then(function (sheetInfo)
            {
                mySheet.sheetInfo = sheetInfo;
                self.ready = true;
            });
    }
};
