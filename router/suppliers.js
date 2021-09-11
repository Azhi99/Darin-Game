const db = require('../DB/dbConfig.js')
const express = require('express')
const jwt = require('jsonwebtoken');
const router = express.Router()

router.post('/addSupplier', async(req,res) => {
    try {
       const [supplierID] = await db('tbl_suppliers').insert({
            supplierName: req.body.supplierName,
            phone: req.body.phone,
            address: req.body.address,
            previousBalance: req.body.previousBalance || 0,
            userID: 3,
        })
         res.status(201).send({
             supplierID
         })
    } catch (error) {
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This supplier already exist'
            });
        }
    }
})

router.patch('/updateSupplier/:supplierID', async(req,res) => {
    try {
        await db('tbl_suppliers').where('supplierID', req.params.supplierID).update({
            supplierName: req.body.supplierName,
            phone: req.body.phone,
            address: req.body.address,
            previousBalance: req.body.previousBalance || 0,
            userID: 3,
        })
    } catch (error) {
        if(error.errno == 1062) {
            res.status(500).send({
                message: 'This supplier already exist'
            })
        }
    }
})

// instead of delete
router.patch('/deactive/:supplierID', async(req,res) => {
    try {
        await db('tbl_suppliers').where('supplierID', req.params.supplierID).update({
            activeStatus: '0'
        })
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})


router.get('/allSuppliers', async(req,res) => {
    try {
        const [allSuppliers] = await db.raw(`SELECT
        tbl_suppliers.supplierID,
        tbl_suppliers.supplierName,
        tbl_suppliers.phone,
        tbl_suppliers.address,
        tbl_suppliers.previousBalance,
        tbl_suppliers.createAt,
        tbl_suppliers.activeStatus,
        tbl_purchases.paymentType,
        IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
        tbl_purchases.stockType = 'p' THEN tbl_purchases.totalPrice END), 0) + IFNULL(tbl_suppliers.previousBalance, 0) - (IFNULL(SUM(tbl_return_debt.amountReturn), 0) + IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
        tbl_purchases.stockType = 'rp' THEN tbl_purchases.totalPrice END), 0)) AS totalRemain
      FROM tbl_purchases
        RIGHT OUTER JOIN tbl_suppliers
          ON tbl_purchases.supplierID = tbl_suppliers.supplierID
        LEFT OUTER JOIN tbl_return_debt
          ON tbl_return_debt.supplierID = tbl_suppliers.supplierID
      WHERE tbl_suppliers.activeStatus = '1'
      GROUP BY tbl_suppliers.supplierID`)
         res.status(200).send(allSuppliers)
    } catch (error) {
        res.status(500).send(error)
    }
})

// return debt 
// refernce NO is optional
router.post('/addReturnDebt', async(req,res) => {
    try {
       const [rdID] = await db('tbl_return_debt').insert({
            supplierID: req.body.supplierID,
            amountReturn: req.body.amountReturn || 0,
            referenceNO: req.body.referenceNO,
            discount: req.body.discount,
            dollarPrice: req.body.dollarPrice,
            purchaseNumbers: req.body.purchaseNumbers.length ? req.body.purchaseNumbers.join(',') : null,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], 'sulyMarket001')).userID
        })
        
        if(req.body.purchaseNumbers.length) {
            await db('tbl_purchases').whereIn('purchaseID', req.body.purchaseNumbers).update({
                debtStatus: '1',
                updateAt: new Date(),
                userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], 'sulyMarket001')).userID
            });
        }
        res.status(201).send({
            rdID
        });
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateReturnDebt/:rdID', async(req,res) => {
    try {
        await db('tbl_return_debt').where('rdID', req.params.rdID).update({
            amountReturn: req.body.amountReturn || 0,
            referenceNO: req.body.referenceNO || null,
            discount: req.body.discount,
            dollarPrice: req.body.dollarPrice,
        })

        if(req.body.purchaseNumbers.length) {
            const [{oldPurchases}] = await db('tbl_return_debt').where('rdID', req.params.rdID).select(['purchaseNumbers as oldPurchases']);
            const newPurchases = oldPurchases + ',' + req.body.purchaseNumbers.join(',');
            await db('tbl_return_debt').where('rdID', req.params.rdID).update({
                purchaseNumbers: newPurchases
            });
            await db('tbl_purchases').whereIn('purchaseID', req.body.purchaseNumbers).update({
                debtStatus: '1'
            });
            return res.status(200).send({
                newPurchases
            });
        }
        return res.sendStatus(200);
        
    } catch (error) {
        res.status(200).send(error);
    }
})

router.delete('/deletePurchase/:rdID/:purchaseID/:userID', async (req, res) => {
    const [{purchaseNumbers}] = await db('tbl_return_debt').where('rdID', req.params.rdID).select(['purchaseNumbers']);
    const purchases = purchaseNumbers.split(',').filter(obj => obj != req.params.purchaseID);
    await db('tbl_return_debt').where('rdID', req.params.rdID).update({
        purchaseNumbers: purchases.join(',') || null
    });
    await db('tbl_purchases').where('purchaseID', req.params.purchaseID).update({
        debtStatus: '0'
    });
    res.sendStatus(200);
});

router.get('/todayReturnDebt', async (req, res) => {
    try {
        const [todayReturnDebt] = await db.raw(`SELECT
        tbl_return_debt.rdID,
        tbl_suppliers.supplierID,
        tbl_suppliers.supplierName,
        tbl_return_debt.amountReturn,
        tbl_return_debt.referenceNO,
        tbl_return_debt.discount,
        tbl_return_debt.dollarPrice,
        tbl_return_debt.purchaseNumbers,
        tbl_return_debt.createAt,
        tbl_users.userName
      FROM tbl_suppliers
        INNER JOIN tbl_users
          ON tbl_suppliers.userID = tbl_users.userID
        INNER JOIN tbl_return_debt
          ON tbl_return_debt.userID = tbl_users.userID
          AND tbl_return_debt.supplierID = tbl_suppliers.supplierID
          where date(tbl_return_debt.createAt) = "${new Date().toISOString().split('T')[0]}"`)
           res.status(200).send(todayReturnDebt)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getDebtPurchases/:supplierID', async (req, res) => {
    const debtPurchases = await db('tbl_purchases').where('supplierID', req.params.supplierID).andWhere('paymentType', 'd').andWhere('debtStatus', '0').andWhere('stockType', 'p').select(['purchaseID']);
    const purchases = debtPurchases.map(({purchaseID}) => purchaseID);
    res.status(200).send(purchases);
});

router.get('/getDebtsList', async (req, res) => {
    const [debtsList] = await db.raw(`SELECT
        tbl_suppliers.supplierName,
        SUM(tbl_purchases.totalPrice) as totalDebt
            FROM tbl_purchases
                JOIN tbl_suppliers ON tbl_purchases.supplierID = tbl_suppliers.supplierID
            WHERE tbl_purchases.paymentType = 'd' AND tbl_purchases.debtStatus = '0' AND tbl_purchases.stockType = 'p'
        GROUP BY tbl_purchases.supplierID
        ORDER BY 2 DESC
    `);
    res.status(200).send(debtsList);
});

router.get('/debtSupToCust', async(req,res) => {
    try {
        const [debtSupToCust] = await db.raw(`SELECT
        view_debt_with_partner_sup_to_cust.supplierID AS supplierID,
       view_debt_with_partner_sup_to_cust.supplierName AS supplierName,
       IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
           tbl_purchases.stockType = 'p' THEN tbl_purchases.totalPrice END), 0) + view_debt_with_partner_sup_to_cust.previousBalance - (IFNULL(SUM(tbl_return_debt.amountReturn), 0) + IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
           tbl_purchases.stockType = 'rp' THEN tbl_purchases.totalPrice END), 0)) AS totalRemainSupplier,
       view_debt_with_partner_sup_to_cust.totalRemainCustomer AS totalRemainCustomer,
       IF(IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
           tbl_purchases.stockType = 'p' THEN tbl_purchases.totalPrice END), 0) + view_debt_with_partner_sup_to_cust.previousBalance - (IFNULL(SUM(tbl_return_debt.amountReturn), 0) + IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
           tbl_purchases.stockType = 'rp' THEN tbl_purchases.totalPrice END), 0)) - view_debt_with_partner_sup_to_cust.totalRemainCustomer >= 0, IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
           tbl_purchases.stockType = 'p' THEN tbl_purchases.totalPrice END), 0) + view_debt_with_partner_sup_to_cust.previousBalance - (IFNULL(SUM(tbl_return_debt.amountReturn), 0) + IFNULL(SUM(CASE WHEN tbl_purchases.paymentType = 'd' AND
           tbl_purchases.stockType = 'rp' THEN tbl_purchases.totalPrice END), 0)) - view_debt_with_partner_sup_to_cust.totalRemainCustomer, 0) AS totalRemainAll
     FROM ((view_debt_with_partner_sup_to_cust
       LEFT JOIN tbl_purchases
         ON (view_debt_with_partner_sup_to_cust.supplierID = tbl_purchases.supplierID))
       LEFT JOIN tbl_return_debt
         ON (view_debt_with_partner_sup_to_cust.supplierID = tbl_return_debt.supplierID))
     GROUP BY view_debt_with_partner_sup_to_cust.supplierName
     order by 1`)
     res.status(200).send({
         debtSupToCust
     })
    } catch (error) {
        res.status(500).send(error)
    }
})

module.exports = router