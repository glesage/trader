/**
 * Boot is responsible for getting all account & backup data
 * back into the system and sent back to the caller
 */
module.exports = function ()
{
    let rData = {
        data:
        {},
        fees:
        {}
    };
    let systemsOperational = 0;
    let systemsNotOperational = 0;
    let systemsNeedOperation = 4;
    let bitfinex, callback;

    const self = this;
    self.init = init;
    return this;

    function init(bitfnx, cb)
    {
        bitfinex = bitfnx;
        callback = cb;

        // Cannot do in parallel due to nonce business
        restoreFees(function ()
        {
            checkActiveOrder(function ()
            {
                restorePositions(function ()
                {
                    restoreBalance();
                });
            });
        });
    }

    function systemCheck(system, err)
    {
        if (err)
        {
            console.log('BAD - ' + system);
            systemsNotOperational++;

            console.error(err);
        }
        else
        {
            console.log('OK - ' + system);
            systemsOperational++;
        }

        if (systemsOperational === systemsNeedOperation)
        {
            console.log('==================');
            console.log('System operational');
            callback(rData.data, rData.fees);
        }
        else if ((systemsOperational + systemsNotOperational) === systemsNeedOperation)
        {
            console.log('==================');
            console.log('System boot failed');
        }
    }

    function restoreBalance(callback)
    {
        bitfinex.getUpdatedBalance(function (err, balance)
        {
            if (err || balance === null)
            {
                if (callback) callback();
                return systemCheck('balance', new Error('Could not get balance: ' + err.message));
            }

            rData.data.balanceUSD = balance;

            if (callback) callback();
            systemCheck('balance');
        });
    }

    function restoreFees(callback)
    {
        bitfinex.getFees(function (err, fees)
        {
            if (err || !fees)
            {
                if (callback) callback();
                return systemCheck('fees', new Error('Could not get account fees: ' + err.message));
            }

            rData.fees = fees;

            if (callback) callback();
            systemCheck('fees');
        });
    }

    function restorePositions(callback)
    {
        bitfinex.getActivePositions(function (err, positions)
        {
            if (err)
            {
                if (callback) callback();
                return systemCheck('positions', new Error('Could not get active positions: ' + err.message));
            }

            if (!positions || !positions.length)
            {
                if (callback) callback();
                return systemCheck('positions');
            }

            rData.data.positions = positions;

            if (callback) callback();
            systemCheck('positions');
        });
    }

    function checkActiveOrder(callback)
    {
        bitfinex.getActiveOrders(function (err, activeOrder)
        {
            if (err)
            {
                if (callback) callback();
                return systemCheck('orders', new Error('Could not get active orders: ' + err.message));
            }

            if (!activeOrder)
            {
                if (callback) callback();
                return systemCheck('orders');
            }

            // Set the last buy or sell order
            if (activeOrder.type === 'buy') rData.data.activeBuy = activeOrder;
            else rData.data.activeBuy = null;
            if (activeOrder.type === 'sell') rData.data.activeSell = activeOrder;
            else rData.data.activeSell = null;

            if (callback) callback();
            systemCheck('orders');
        });
    }
};