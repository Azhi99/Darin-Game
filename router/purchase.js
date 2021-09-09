const db = require('../DB/dbConfig.js')
const express = require('express')
const router = express.Router()

router.get('/', (req, res) => {
    const page = req.query.page
    
    const fields = [
        'tp.purchaseID', 'tp.supplierID', 'ts.supplierName',
        'tp.referenceNo', 'tp.totalPrice', 'tp.paymentType',
        'tp.purchaseStatus', 'tu.userID', 'tu.userName'
    ]

    db('tbl_purchases as tp')
    .join('tbl_suppliers as ts', 'ts.supplierID', 'tp.supplierID')
    .join('tbl_users as tu', 'tu.userID', 'tp.userIDUpdate')
    .offset((page -1) * 20).limit(20)
    .select(fields)
    .then(purchases => {
        db('tbl_purchases').count('* as count')
        .then(([{count}]) => { 
            console.log(count);
            res.send({nop: count, purchases})
        })
        
    })

})

module.exports = router