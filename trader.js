module.exports = function (RISK, FEE)
{
    var self = this;
    self.recordTrade = recordTrade;
    self.masterpiece = masterpiece;
    return self;

    var totalAmount, totalSpent;

    /* Public */
    function recordTrade(trade)
    {
        var amount = parseFloat(trade.amount);
        var price = parseFloat(trade.price);

        if (!totalAmount || !totalSpent)
        {
            totalAmount = amount;
            totalSpent = amount * price;
        }
        else
        {
            totalAmount += amount;
            totalSpent += amount * price;
        }
    }

    function masterpiece()
    {
        if (!totalSpent || !totalAmount) return null;

        var data = {
            timestamp: Date.now(),
            average: average()
        };
        var riskCoeficient = (RISK / 2) + FEE;
        data.support = data.average + (data.average * riskCoeficient);
        data.resistance = data.average - (data.average * riskCoeficient);

        return data;
    }

    /* private */
    function average()
    {
        return totalSpent / totalAmount;
    }
};
