/* Dependencies */
var GoogleSpreadsheet = require("google-sheets-node-api");

/**
 * Sheets responsible for displaying data on google drive sheets
 * mostly for logging & monitoring purposes
 *
 * Takes a Sheet ID and credentials string
 */
module.exports = function ()
{
    var SHEETS_CREDS = JSON.parse(process.env.DRIVE_CREDS);
    var mySheet = new GoogleSpreadsheet(process.env.DRIVE_SHEET);

    var self = this;
    self.recordMyTrade = recordMyTrade;
    return self;

    /* Public */
    function recordMyTrade(trade)
    {
        return createData('my-trades', trade);
    }

    /* Private */
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
        return mySheet.useServiceAccountAuth(SHEETS_CREDS)
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
