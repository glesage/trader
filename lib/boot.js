var Order = require('./order');

/**
 * Boot is responsible for getting all account & backup data
 * back into the system and sent back to the caller
 */
module.exports = function ()
{
    var rData = {
        data: {},
        fees: {}
    };
    var systemsOperational = 0;
    var systemsNotOperational = 0;
    var systemsNeedOperation = 3;
    var bitfinex, callback;

    var self = this;
    self.init = init;
    return this;

    function init(bitfnx, cb)
    {
        bitfinex = bitfnx;
        callback = cb;

        restoreFees(function ()
        {
            restoreOrders(function ()
            {
                restoreBalances();
            });
        });
    }

    function systemCheck(system, err)
    {
        if (err)
        {
            console.log("BAD - " + system);
            systemsNotOperational++;
        }
        else
        {
            console.log("OK - " + system);
            systemsOperational++;
        }

        if (systemsOperational === systemsNeedOperation)
        {
            console.log("==================");
            console.log("System operational");
            callback(rData.data, rData.fees);
        }
        else if ((systemsOperational + systemsNotOperational) === systemsNeedOperation)
        {
            console.log("==================");
            console.log("System boot failed");
        }
    }

    function restoreBalances(callback)
    {
        bitfinex.getUpdatedBalances(function (balances)
        {
            if (!balances)
            {
                if (callback) callback();
                return systemCheck("balances", new Error("Could not get balances: " + err.message));
            }

            rData.data.balanceBTC = balances.balanceBTC;
            rData.data.balanceUSD = balances.balanceUSD;

            if (callback) callback();
            systemCheck("balances");
        });
    }

    function restoreFees(callback)
    {
        bitfinex.rest.account_infos(function (err, res)
        {
            if (err || !res || !res.length)
            {
                if (callback) callback();
                return systemCheck("fees", new Error("Could not get account fees: " + err.message));
            }

            try
            {
                // Set the maker & taker fees
                var myFees = res[0];
                if (myFees.maker_fees) rData.fees.maker = parseFloat(myFees.maker_fees) / 100;
                if (myFees.taker_fees) rData.fees.taker = parseFloat(myFees.taker_fees) / 100;
            }
            catch (e)
            {
                console.log("Error parsing fees");
                console.log(e);
            }
            if (callback) callback();
            systemCheck("fees");
        });
    }

    function checkActiveOrder(callback)
    {
        bitfinex.rest.active_orders(function (err, res)
        {
            if (err || !res)
            {
                if (callback) callback(null);
                return systemCheck("orders", new Error("Could not get active orders: " + err.message));
            }

            if (!res.length)
            {
                if (callback) callback(null);
                return systemCheck("orders");
            }

            // Set the last buy or sell order
            var activeOrder = new Order.fromRestA(res[0]);
            if (activeOrder.type === 'buy') rData.data.activeBuy = activeOrder;
            else rData.data.activeBuy = null;
            if (activeOrder.type === 'sell') rData.data.activeSell = activeOrder;
            else rData.data.activeSell = null;

            if (callback) callback(activeOrder);
            systemCheck("orders");
        });
    }

    function checkLastOrder(callback)
    {
        bitfinex.rest.past_trades('btcusd', function (err, res)
        {
            if (err || !res)
            {
                if (callback) callback(null);
                return systemCheck("orders", new Error("Could not get active orders: " + err.message));
            }

            if (!res.length)
            {
                if (callback) callback(null);
                return systemCheck("orders");
            }

            // Set the last buy or sell order
            var lastOrder = new Order.fromRestL(res[0]);
            if (lastOrder.type === 'buy') rData.data.lastBuy = lastOrder;
            else rData.data.lastBuy = null;
            if (lastOrder.type === 'sell') rData.data.lastSell = lastOrder;
            else rData.data.lastSell = null;

            if (callback) callback(lastOrder);
            systemCheck("orders");
        });
    }

    function restoreOrders(callback)
    {
        checkActiveOrder(function (activeOrder)
        {
            // If there is no active order, check for the past orders
            if (!activeOrder)
            {
                systemsOperational--;
                checkLastOrder(callback);
            }
            else if (callback) callback();
        });
    }
};
