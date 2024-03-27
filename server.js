const express = require('express');
const cors = require('cors'); // Import the cors package
const app = express();
const port = 3100;
const crypto = require('crypto');



// Use the cors middleware
app.use(cors());


// Add Access-Control-Allow-Private-Network header
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Private-Network', 'true');
    next();
  });

// Middleware to parse JSON bodies
app.use(express.json());



// Test route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening at http://0.0.0.0:${port}`);
});

const util = require('util');
const debuglog = util.debuglog('server');
debuglog('Server started');


const snowflake = require('snowflake-sdk');

const connection = snowflake.createConnection({
  account: 'ab16868.us-east-2.aws',
  username: 'gyasi',
  password: 'snowflakeGy451!!',
  warehouse: 'python_access',
});

connection.connect((err, conn) => {
  if (err) {
    console.error('Unable to connect to Snowflake: ', err.message);
  } else {
    console.log('Successfully connected to Snowflake.');
  }
});

// route to fetch form data
app.get('/fetch-form-data', (req, res) => {
    // Extract referral_id from query parameters
    const { REFERRAL_ORDER_ID } = req.query;
    console.log(`Received REFERRAL_ORDER_ID: ${REFERRAL_ORDER_ID}`);

    if (!REFERRAL_ORDER_ID) {
        console.log('No REFERRAL_ORDER_ID provided');
        return res.status(400).json({ message: 'Referral ID is required' });
    }

    // Query to select data based on referralId
    const query = `SELECT 
    COALESCE(ro.REFERRALORDERID, rol.REFERRAL_ORDER_ID) AS "Referral ID",
    rol.PATIENT_NAME AS "Patient Name",
    rol.DOB AS "DOB",
    rol.RECIPIENT_ORG_NAME AS "Facility Name",
    rol.RECIPIENT_NAME "Physician",
    ro.PHONENUMBER AS "Phone Number",
    rol.RECIPIENT_FAX AS "FAX Number",
    ro.NEXTCONTACTDATE AS "Next Contact Date",
    ro.STATUS AS "Status",
    ro.APPOINTMENTDATE AS "Appointment Date",
    ro.NOTES AS "Notes"
FROM 
    TWICE.DEV_STAGE.REFERRAL_ORDERS_WITH_LOCATION rol
LEFT JOIN 
    (SELECT * FROM TWICE.DEV_STAGE.REFERRAL_ORDERS ro_inner 
     WHERE ro_inner.CREATEDAT = (SELECT MAX(CREATEDAT) FROM TWICE.DEV_STAGE.REFERRAL_ORDERS WHERE REFERRALORDERID = ro_inner.REFERRALORDERID)) ro
ON 
    rol.REFERRAL_ORDER_ID = ro.REFERRALORDERID
WHERE 
    rol.REFERRAL_ORDER_ID = ?`;


    console.log(`Executing query: ${query}`);

    // Execute query
    connection.execute({
        sqlText: query,
        binds: [REFERRAL_ORDER_ID], // Use REFERRAL_ORDER_ID here
        complete: (err, stmt, rows) => {
            if (err) {
                console.error('Failed to execute query: ', err.message);
                return res.status(500).json({ message: 'Failed to fetch data' });
            }

            console.log(`Query executed successfully, number of rows returned: ${rows.length}`);

            // Assuming rows is an array of records, and we're interested in the first one
            if (rows.length > 0) {
                const data = rows[0]; // Assuming the first row is the one we want
                console.log(`Sending data back to client: ${JSON.stringify(data)}`);
                res.json(data); // Send data back to client
            } else {
                console.log('No data found');
                res.status(404).send('No data found');
            }
        },
    });
});




  // route to fetch all referral IDs for a specific patient with outstanding resolution state
  app.get('/fetch-patient-referrals', (req, res) => {
    // Extract patient_id from query parameters
    const { patient_id } = req.query;
    console.log(`patient_id: ${patient_id}`);

    if (!patient_id) {
        return res.status(400).send('Patient ID is required');
    }

    // Query to select referral_order_id, recipient_specialty, and clinical_reason based on patient_id and resolution_state
    const query = `SELECT REFERRAL_ORDER_ID, RECIPIENT_SPECIALTY, CLINICAL_REASON, PRIORITY  FROM TWICE.DEV_STAGE.REFERRAL_ORDERS_WITH_LOCATION WHERE patient_id = ? AND resolution_state = 'outstanding'`;

    // Execute query
    connection.execute({
        sqlText: query,
        binds: [patient_id],
        complete: (err, stmt, rows) => {
            if (err) {
                console.error('Failed to execute query: ', err.message);
                return res.status(500).send('Failed to fetch data');
            }
            
            // Assuming rows is an array of records
            if (rows.length > 0) {
                console.log(rows[0]); // Log the first row to see what properties it has
                const referrals = rows.map(row => ({
                    referralOrderId: row.REFERRAL_ORDER_ID,
                    recipientSpecialty: row.RECIPIENT_SPECIALTY,
                    clinicalReason: row.CLINICAL_REASON,
                    priority: row.PRIORITY
                }));
                res.json(referrals); // Send referral data back to client
            } else {
                res.status(404).send('No data found');
            }
        },
    });
});
  
// Route to fetch patient demographics
app.get('/fetch-patient-demographics', (req, res) => {
    // Extract patient_id from query parameters
    const { patient_id } = req.query;
    console.log('Received request for patient_id:', patient_id);
    console.log(`patient_id: ${patient_id}`);
    if (!patient_id) {
        console.error('Error: Patient ID is required');
        return res.status(400).send('Patient ID is required');
    }

    // SQL query to select patient demographics
    const query = `SELECT FIRST_NAME, LAST_NAME, DOB 
                   FROM ELATION.HERSELF_HEALTH.PATIENT 
                   WHERE ID = ?`;
    console.log('Executing query:', query);

    // Execute query
    connection.execute({
        sqlText: query,
        binds: [patient_id],
        complete: (err, stmt, rows) => {
            if (err) {
                console.error('Failed to execute query: ', err.message);
                return res.status(500).send('Failed to fetch data');
            }

            console.log('Query executed successfully, number of rows returned:', rows.length);

            if (rows.length > 0) {
                const data = rows[0]; // Assuming the first row is the one we want

            // Convert DOB to string in the format YYYY-MM-DD
            if (data.DOB instanceof Date) {
                data.DOB = data.DOB.toISOString().slice(0, 10);
            }

                console.log('Sending data back to client:', data);
                res.json(data); // Send data back to client
            } else {
                console.error('No data found for patient_id:', patient_id);
                res.status(404).send('No data found');
            }
        },
    });
});



// Helper function to execute SQL
async function executeSql(sqlText, binds) {
    return new Promise((resolve, reject) => {
        connection.execute({
            sqlText,
            binds,
            complete: (err, stmt, rows) => {
                if (err) {
                    console.error('Failed to execute query', err.message);
                    return reject(err);
                }
                resolve(rows);
            },
        });
    });
}


// Function to get the most recent status from history
async function getLatestHistoryStatus(ReferralOrderID) {
    try {
        const historyResult = await executeSql(
            `SELECT Status FROM TWICE.DEV_STAGE.referral_orders_history WHERE ReferralOrderID = ? ORDER BY ChangedAt DESC LIMIT 1`,
            [ReferralOrderID]
        );
        return historyResult.length > 0 ? historyResult[0].Status : null;
    } catch (err) {
        console.error('Failed to fetch latest history status:', err.message);
        return null; // Consider how you want to handle errors
    }
}

app.post('/submit-referral', async (req, res) => {
    const formData = req.body;
    let {
        ReferralOrderID,
        facilityName: FacilityName = '',
        physician: Physician = '',
        phoneNumber: PhoneNumber = '',
        nextContactDate: NextContactDate = '',
        status: Status = '',
        appointmentDate: AppointmentDate = '',
        notes: Notes = ''
    } = formData;

    if (!ReferralOrderID) {
        return res.status(400).json({ message: 'ReferralOrderID is required' });
    }

    NextContactDate = NextContactDate && !isNaN(Date.parse(NextContactDate)) ? NextContactDate : null;
    AppointmentDate = AppointmentDate && !isNaN(Date.parse(AppointmentDate)) ? AppointmentDate : null;

    try {
        let currentStatus = null;
        // Retrieve the current status and other fields for the ReferralOrderID
        let queryResult = await new Promise((resolve, reject) => {
            connection.execute({
                sqlText: `SELECT Status FROM TWICE.DEV_STAGE.referral_orders_history WHERE ReferralOrderID = ? ORDER BY ChangedAt DESC LIMIT 1`,
                binds: [ReferralOrderID],
                complete: (err, stmt, rows) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(rows);
                },
            });
        });

        if (queryResult.length > 0) {
            console.log(queryResult[0].STATUS);
            console.log(queryResult);
            currentStatus = queryResult[0].STATUS;
            // Update existing record
            let sqlText = `UPDATE TWICE.DEV_STAGE.referral_orders SET FacilityName = ?, Physician = ?, PhoneNumber = ?, Status = ?, Notes = ?, NextContactDate = ?, AppointmentDate = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE ReferralOrderID = ?`;
            await executeSql(sqlText, [FacilityName, Physician, PhoneNumber, Status, Notes, NextContactDate, AppointmentDate, ReferralOrderID]);
        } else {
            // Insert new record
            let sqlText = `INSERT INTO TWICE.DEV_STAGE.referral_orders (ReferralOrderID, FacilityName, Physician, PhoneNumber, NextContactDate, Status, AppointmentDate, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            await executeSql(sqlText, [ReferralOrderID, FacilityName, Physician, PhoneNumber, NextContactDate, Status, AppointmentDate, Notes]);
        }

        // Check if status has changed to decide on inserting into history table
        if (Status !== currentStatus) {
            console.log(Status, currentStatus)
            console.log('Status has changed, inserting into history table');
            let historySqlText = `INSERT INTO TWICE.DEV_STAGE.referral_orders_history (HistoryID, ReferralOrderID, NextContactDate, Status, AppointmentDate, Notes, ChangeType, ChangedAt) VALUES (?, ?, ?, ?, ?, ?, 'STATUS CHANGE', CURRENT_TIMESTAMP)`;
            await executeSql(historySqlText, [crypto.randomUUID(), ReferralOrderID, NextContactDate, Status, AppointmentDate, Notes]);
            res.json({ message: 'Referral order updated successfully, history recorded' });
        } else {
            res.json({ message: 'Referral order updated successfully' });
            console.log('Status has not changed, no need to insert into history table');
        }
    } catch (err) {
        console.error('Operation failed: ', err.message);
        return res.status(500).json({ message: 'Error processing referral order' });
    }
});



async function executeQuery(query) {
    try {
        await checkConnection();
        connection.execute({
            sqlText: query,
            complete: (err, stmt, rows) => {
                if (err) {
                    console.error('Query execution failed:', err.message);
                } else {
                    console.log('Query executed successfully');
                }
            }
        });
    } catch (error) {
        console.error('Failed to check connection:', error.message);
    }
}

// This function attempts to reconnect only if there is no active connection
async function reconnectIfNeeded() {
    return new Promise((resolve, reject) => {
        // Assuming 'connection' is your global Snowflake connection object
        if (connection.isUp()) { // Assuming 'isUp' is a method to check connection status. You may need to implement this check based on Snowflake SDK or your application logic
            console.log('Connection is already active.');
            resolve(connection);
        } else {
            console.log('Attempting to reconnect...');
            const newConnection = snowflake.createConnection({
                account: 'ab16868.us-east-2.aws',
                username: 'gyasi',
                password: 'snowflakeGy451!!',
                warehouse: 'python_access',
            });

            newConnection.connect((err, conn) => {
                if (err) {
                    console.error('Failed to reconnect:', err.message);
                    reject(err);
                } else {
                    console.log('Reconnected successfully');
                    resolve(conn);
                }
            });
        }
    });
}
// Route to re-establish Snowflake connection if needed
app.get('/reconnect-snowflake', async (req, res) => {
    try {
        // Attempt to check and reconnect if needed
        const connection = await reconnectIfNeeded();
        // You might want to add a more robust way to verify the connection is actually usable here
        if (connection) {
            res.json({ status: 'Connected' });
        } else {
            // This else block might not be necessary if your check function always either resolves with a connection or rejects.
            res.json({ status: 'Disconnected' });
        }
    } catch (error) {
        res.status(500).json({ status: 'Error', message: error.message });
    }
});
