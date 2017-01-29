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
    self.recordTraderData = recordTraderData;
    self.getLastTraderData = getLastTraderData;
    return self;

    /* Public */
    function recordMyTrade(trade)
    {
        return createData('my-trades');
    }

    function recordTraderData(data)
    {
        return createData('trader', data);
    }

    function getLastTraderData()
    {
        return getData('trader').then(function (data)
        {
            if (!data || !data.length) return null;
            return data[data.length - 1];
        });
    }

    /* Private */
    function getData(sheetName)
    {
        return checkReady().then(function ()
        {
            var worksheet = getWorksheet(sheetName);
            if (!worksheet) noWorkSheetError(sheetName);
            return worksheet.getRows();
        });
    }

    function createData(sheetName, data)
    {
        return checkReady().then(function ()
        {
            var worksheet = getWorksheet(sheetName);
            if (!worksheet) noWorkSheetError(sheetName);
            return worksheet.addRow(data);
        });
    }

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
