const db = require('../DB/dbConfig.js')
const express = require('express')
const jwt = require('jsonwebtoken');
const router = express.Router()

router.post('/addCustomer', async(req,res) => {
    try {
        const [customerID] = await db('tbl_customers').insert({
            customerName: req.body.customerName,
            phoneNumber: req.body.phoneNumber,
            address: req.body.address || null,
            previousDebt: req.body.previousDebt || 0,
            limitDebt: req.body.limitDebt || 0,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], 'darinGame2021')).userID
        })
        res.status(201).send({
            customerID
        })
    } catch (error) {
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This customer already exist'
            })
        }
        return res.status(500).send(error)
    }
})

router.patch('/updateCustomer/:customerID', async(req,res) => {
    try {
        await db('tbl_customers').where('customerID', req.params.customerID).update({
            customerName: req.body.customerName,
            phoneNumber: req.body.phoneNumber,
            address: req.body.address,
            previousDebt: req.body.previousDebt || 0,
            limitDebt: req.body.limitDebt || 0,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], 'darinGame2021')).userID
        })
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/deactive/:customerID', async(req,res) => {
    try {
        await db('tbl_customers').where('customerID', req.params.customerID).update({
            activeStatus: 0
        })
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/active/:customerID', async(req,res) => {
    try {
        await db('tbl_customers').where('customerID', req.params.customerID).update({
            activeStatus: 1
        })
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/allCustomers', async(req,res) => {
    try {
        const [allCustomers] = await db.raw(`SELECT
        tbl_customers.customerID,
        tbl_customers.customerName,
        tbl_customers.phoneNumber,
        tbl_customers.address,
        tbl_customers.previousDebt,
        tbl_customers.limitDebt,
        tbl_customers.createAt,
        tbl_customers.activeStatus,
        tbl_users.userName,
        IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' THEN tbl_invoices.totalPrice END), 0) + tbl_customers.previousDebt AS totalDebt,
        IFNULL(tbl_return_debt_customer.amountReturn,0) AS totalReturn,
        IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
      tbl_invoices.stockType = 's' THEN tbl_invoices.totalPrice END), 0) + IFNULL(tbl_customers.previousDebt, 0) - IFNULL(tbl_return_debt_customer.amountReturn, 0) + IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
      tbl_invoices.stockType = 'rs' THEN tbl_invoices.totalPrice END), 0) AS totalRemain
      FROM tbl_customers
        INNER JOIN tbl_users
          ON tbl_customers.userID = tbl_users.userID
        LEFT OUTER JOIN tbl_invoices
          ON tbl_invoices.customerID = tbl_customers.customerID
          AND tbl_invoices.userID = tbl_users.userID
        LEFT OUTER JOIN tbl_return_debt_customer
          ON tbl_return_debt_customer.customerID = tbl_customers.customerID
          AND tbl_return_debt_customer.userID = tbl_users.userID
      WHERE tbl_customers.activeStatus = '1'
      GROUP BY tbl_customers.customerID,
               tbl_return_debt_customer.amountReturn`)
           res.status(200).send(allCustomers)
    } catch (error) {
        res.status(500).send(error)   
    }
})

router.get('/countAll', async (req, res) => {
    const [{numberOfCustomers}] = await db('tbl_customers').count('* as numberOfCustomers');
    res.status(200).send({
        numberOfCustomers
    });
});

router.get('/countActives', async (req, res) => {
    const [{numberOfCustomers}] = await db('tbl_customers').where('activeStatus', '1').count('* as numberOfCustomers');
    res.status(200).send({
        numberOfCustomers
    });
});

// Customer Debt Router

router.post('/addReturnDebt', async(req,res) => {
    try {
        const [rdcID] = await db('tbl_return_debt_customer').insert({
            customerID: req.body.customerID,
            amountReturn: req.body.amountReturn || 0,
            discount: req.body.discount || 0,
            dollarPrice: req.body.dollarPrice || 0,
            invoiceNumbers: req.body.invoiceNumbers.join(',') || null,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], 'darinGame2021')).userID
        })
        // if(req.body.invoiceNumbers.length > 0) {
        //     await db('tbl_invoices').whereIn('invoiceID', req.body.invoiceNumbers).update({
        //         invoiceType: 'c',
        //         updateAt: new Date(),
        //         userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], 'darinGame2021')).userID
        //     });
        // }
        res.status(201).send({
            rdcID
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateReturnDebt/:rdcID', async(req,res) => {
    try {
        await db('tbl_return_debt_customer').where('rdcID', req.params.rdcID).update({
            amountReturn: req.body.amountReturn || 0,
            discount: req.body.discount || 0,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], 'darinGame2021')).userID
        })
        if(req.body.invoiceNumbers.length > 0) {
            const [{oldInvoices}] = await db('tbl_return_debt_customer').where('rdcID', req.params.rdcID).select(['invoiceNumbers as oldInvoices']);
            const newInvoices = oldInvoices + ',' + req.body.invoiceNumbers.join(',');
            await db('tbl_return_debt_customer').where('rdcID', req.params.rdcID).update({
                invoiceNumbers: newInvoices
            });
            await db('tbl_invoices').whereIn('invoiceID', req.body.invoiceNumbers).update({
                invoiceType: 'c',
                updateAt: new Date(),
                userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], 'darinGame2021')).userID
            });
            return res.status(200).send({
                newInvoices
            })
        }
        return res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
}

)

router.delete('/deleteReturnDebt/:rdcID', async(req,res) => {
    try {
        await db('tbl_return_debt_customer').where('rdcID', req.params.rdcID)
        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteInvoice/:rdcID/:invoiceID/:userID', async (req, res) => {
    const [{invoices}] = await db('tbl_return_debt_customer').where('rdcID', req.params.rdcID).select(['invoiceNumbers as invoices']);
    const invoiceNumbers = invoices.split(',').filter(obj => obj != req.params.invoiceID);
    await db('tbl_return_debt_customer').where('rdcID', req.params.rdcID).update({
        invoiceNumbers: invoiceNumbers.join(',') || null
    });
    await db('tbl_invoices').where('invoiceID', req.params.invoiceID).update({
        invoiceType: 'd',
        updateAt: new Date(),
        userIDUpdate: req.params.userID
    });
    res.sendStatus(200);
});

router.get('/todayReturnDebt', async(req,res) => {
    try {
        const [todayReturnDebt] = await db.raw(`SELECT
        tbl_return_debt_customer.rdcID,
        tbl_customers.customerID,
        tbl_customers.customerName,
        tbl_return_debt_customer.amountReturn,
        tbl_return_debt_customer.discount,
        tbl_return_debt_customer.dollarPrice,
        tbl_return_debt_customer.invoiceNumbers,
        tbl_return_debt_customer.createAt,
        tbl_users.userName
      FROM tbl_customers
        INNER JOIN tbl_users
          ON tbl_customers.userID = tbl_users.userID
        INNER JOIN tbl_return_debt_customer
          ON tbl_return_debt_customer.userID = tbl_users.userID
          AND tbl_return_debt_customer.customerID = tbl_customers.customerID
          where date(tbl_return_debt_customer.createAt) = "${new Date().toISOString().split('T')[0]}"`)
           res.status(200).send(todayReturnDebt)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/oneDateReturnDebt/:from', async(req,res) => {
    try {
        const [oneDateReturnDebt] = await db.raw(`SELECT
        tbl_return_debt_customer.rdcID,
        tbl_customers.customerName,
        tbl_return_debt_customer.amountReturn,
        tbl_return_debt_customer.discount,
        tbl_return_debt_customer.dollarPrice,
        tbl_return_debt_customer.createAt,
        tbl_users.userName
      FROM tbl_customers
        INNER JOIN tbl_users
          ON tbl_customers.userID = tbl_users.userID
        INNER JOIN tbl_return_debt_customer
          ON tbl_return_debt_customer.userID = tbl_users.userID
          AND tbl_return_debt_customer.customerID = tbl_customers.customerID
          where date(tbl_return_debt_customer.createAt) = "${req.params.from}"`)
           res.status(200).send(oneDateReturnDebt)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/betweenDateReturnDebt/:from/:to', async(req,res) => {
    try {
        const [betweenDateReturnDebt] = await db.raw(`SELECT
        tbl_return_debt_customer.rdcID,
        tbl_customers.customerName,
        tbl_return_debt_customer.amountReturn,
        tbl_return_debt_customer.discount,
        tbl_return_debt_customer.dollarPrice,
        tbl_return_debt_customer.createAt,
        tbl_users.userName
      FROM tbl_customers
        INNER JOIN tbl_users
          ON tbl_customers.userID = tbl_users.userID
        INNER JOIN tbl_return_debt_customer
          ON tbl_return_debt_customer.userID = tbl_users.userID
          AND tbl_return_debt_customer.customerID = tbl_customers.customerID
          where date(tbl_return_debt_customer.createAt) between "${req.params.from}" and "${req.params.to}"`)
           res.status(200).send(betweenDateReturnDebt) 
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getDebtInvoices/:customerID', async (req, res) => {
    const debtInvoices = await db('tbl_invoices').where('customerID', req.params.customerID).andWhere('invoiceType', 'd').andWhere('stockType', 's').select(['invoiceID']).orderBy('invoiceID', 'asc');
    const invoices = debtInvoices.map(({invoiceID}) => invoiceID);
    res.status(200).send(invoices);
});

router.get('/getDebtsList', async (req, res) => {
    const [debtsList] = await db.raw(`SELECT
        tbl_customers.customerName,
        SUM(tbl_invoices.totalPrice - tbl_invoices.totalPay) as totalDebt
            FROM tbl_invoices
                JOIN tbl_customers ON tbl_invoices.customerID = tbl_customers.customerID
            WHERE tbl_invoices.sellStatus = '1' AND tbl_invoices.invoiceType = 'd' AND tbl_invoices.stockType = 's'
        GROUP BY tbl_invoices.customerID
        ORDER BY 2 DESC
    `);
    res.status(200).send(debtsList);
});

router.get('/debtCustToSup', async(req,res) => {
    try {
        const [debtCustToSup] = await db.raw(`SELECT
        view_debt_with_partner_cust_to_sup.customerID AS customerID,
        view_debt_with_partner_cust_to_sup.customerName AS customerName,
        view_debt_with_partner_cust_to_sup.previousDebt AS previousDebt,
        view_debt_with_partner_cust_to_sup.totalRemainSupplier AS totalRemainSupplier,
        IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 's' THEN tbl_invoices.totalPrice END), 0) + IFNULL(view_debt_with_partner_cust_to_sup.previousDebt, 0) - (IFNULL(tbl_return_debt_customer.amountReturn, 0) + IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 'rs' THEN tbl_invoices.totalPrice END), 0) + IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 's' THEN tbl_invoices.totalPay END), 0)) AS totalRemainCustomer,
        IF(-1 * (view_debt_with_partner_cust_to_sup.totalRemainSupplier - IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 's' THEN tbl_invoices.totalPrice END), 0) + IFNULL(view_debt_with_partner_cust_to_sup.previousDebt, 0) - (IFNULL(tbl_return_debt_customer.amountReturn, 0) + IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 'rs' THEN tbl_invoices.totalPrice END), 0) + IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 's' THEN tbl_invoices.totalPay END), 0))) >= 0, -1 * (view_debt_with_partner_cust_to_sup.totalRemainSupplier - IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 's' THEN tbl_invoices.totalPrice END), 0) + IFNULL(view_debt_with_partner_cust_to_sup.previousDebt, 0) - (IFNULL(tbl_return_debt_customer.amountReturn, 0) + IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 'rs' THEN tbl_invoices.totalPrice END), 0)) + IFNULL(SUM(CASE WHEN tbl_invoices.invoiceType = 'd' AND
            tbl_invoices.stockType = 's' THEN tbl_invoices.totalPay END), 0)), 0) AS totalRemainAll
      FROM ((view_debt_with_partner_cust_to_sup
        LEFT JOIN tbl_invoices
          ON (view_debt_with_partner_cust_to_sup.customerID = tbl_invoices.customerID))
        LEFT JOIN tbl_return_debt_customer
          ON (view_debt_with_partner_cust_to_sup.customerID = tbl_return_debt_customer.customerID))
      GROUP BY view_debt_with_partner_cust_to_sup.customerName
      order by 1`)

        res.status(200).send({
            debtCustToSup
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

module.exports = router