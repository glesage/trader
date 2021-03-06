/* Dependencies */
const GoogleSpreadsheet = require('google-sheets-node-api');

/**
 * Sheets responsible for displaying data on google drive sheets
 * mostly for logging & monitoring purposes
 *
 * Takes a Sheet ID and credentials string
 */
module.exports = function ()
{
    const SHEETS_CREDS = JSON.parse(process.env.DRIVE_CREDS);
    const mySheet = new GoogleSpreadsheet(process.env.DRIVE_SHEET);

    const self = this;
    self.recordMyTrade = recordMyTrade;
    self.recordTraderData = recordTraderData;
    return self;

    /* Public */
    function recordMyTrade(trade)
    {
        return createData('my-trades', trade);
    }

    function recordTraderData(data)
    {
        return createData('trader', data);
    }

    /* Private */
    function createData(sheetName, data)
    {
        return checkReady().then(function ()
        {
            const worksheet = getWorksheet(sheetName);
            if (!worksheet) noWorkSheetError(sheetName);
            return worksheet.addRow(data);
        });
    }

    function getWorksheet(type)
    {
        if (!mySheet.sheetInfo || !mySheet.sheetInfo.worksheets || !mySheet.sheetInfo.worksheets.length) return null;
        const ws = mySheet.sheetInfo.worksheets.find(function (ws)
        {
            return ws.title.toLowerCase() === type.toLowerCase();
        });
        return ws;
    }

    function noWorkSheetError(name)
    {
        let unsupported = new Error('Unable to find ' + name + ' worksheet');
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