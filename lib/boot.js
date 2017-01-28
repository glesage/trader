/**
 * Boot is responsible for getting all account & backup data
 * back into the system and sent back to the caller
 */
module.exports = function ()
{
    var rData = {
        data: {},
        traderData: {},
        fees: {}
    };
    var systemsOperational = 0;
    var systemsNotOperational = 0;
    var systemsNeedOperation = 4;
    var rest, gds, cb;

    var self = this;
    self.init = init;
    return this;

    function init(bitfinexREST, sheet, callback)
    {
        rest = bitfinexREST;
        gds = sheet;
        cb = callback;

        restoreTraderData();
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
            console.log("NOT OK - " + system);
            systemsNotOperational++;
        }
        else
        {
            console.log("    OK - " + system);
            systemsOperational++;
        }

        if (systemsOperational === systemsNeedOperation)
        {
            console.log("==================");
            console.log("System operational");
            cb(rData.data, rData.traderData, rData.fees);
        }
        else if ((systemsOperational + systemsNotOperational) === systemsNeedOperation)
        {
            console.log("==================");
            console.log("System boot failed");
        }
    }

    /* Private */
    // bws.on('ws', function (data)
    // {
    //     if (!data || data.length < 5) return;

    //     // If the system is already ready then skip
    //     if (systemsOperational >= systemsNeedOperation) return console.log(data);

    //     var currency = data[1];
    //     var available = data[4];

    //     try
    //     {
    //         if (currency === 'btc') rData.data.balanceBTC = parseFloat(available);
    //         if (currency === 'usd') rData.data.balanceUSD = parseFloat(available);
    //     }
    //     catch (e)
    //     {
    //         console.log("Error parsing balances");
    //         console.log(e);
    //     }
    //     systemCheck("balances");
    // });

    function restoreTraderData()
    {
        gds.getLastTraderData().then(function (tData)
        {
            if (!tData) return systemCheck("trader");

            rData.data.balanceUSD = parseFloat(tData.balanceusd) || 0;
            rData.data.balanceBTC = parseFloat(tData.balancebtc) || 0;

            rData.traderData.resistanceZone = parseFloat(tData.resistancezone) || 0;
            rData.traderData.highestSupportZone = parseFloat(tData.supportzone) || 0;

            systemCheck("trader");
        }).catch(function (err)
        {
            systemCheck("trader", err);
        });
    }

    function restoreBalances(callback)
    {
        rest.wallet_balances(function (err, res)
        {
            if (err || !res || !res.length)
            {
                if (callback) callback();
                return systemCheck("balances", new Error("Could not get account balances: " + err.message));
            }

            var btcBalance = res.find(function (b)
            {
                return b.currency === "btc";
            });
            var usdBalance = res.find(function (b)
            {
                return b.currency === "usd";
            });
            try
            {
                if (btcBalance) rData.data.balanceBTC = parseFloat(btcBalance.available);
                if (usdBalance) rData.data.balanceUSD = parseFloat(usdBalance.available);
            }
            catch (e)
            {
                console.log("Error parsing balances");
                console.log(e);
            }
            if (callback) callback();
            systemCheck("balances");
        });
    }

    function restoreFees(callback)
    {
        rest.account_infos(function (err, res)
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

    function restoreOrders(callback)
    {
        rest.active_orders(function (err, res)
        {
            if (err || !res)
            {
                if (callback) callback();
                return systemCheck("orders", new Error("Could not get active orders: " + err.message));
            }

            if (!res.length)
            {
                if (callback) callback();
                return systemCheck("orders");
            }

            // Set the last buy or sell order
            var activeOrder = res[0];
            if (activeOrder.side === 'buy') rData.data.lastBuy = activeOrder;
            if (activeOrder.side === 'sell') rData.data.lastSell = activeOrder;

            if (callback) callback();
            systemCheck("orders");
        });
    }
};