const sql = require('mssql');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors'); // เพิ่มการใช้งาน CORS
const bcrypt = require('bcryptjs'); // Import bcrypt
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const crypto = require('crypto');



const app = express();

app.use(express.json());
// app.use(cors({
//     origin: '*', // หรือระบุโดเมนที่ต้องการ
//     methods: 'GET,POST,PUT,DELETE',
// }));
app.use(bodyParser.json()); 

app.use(cors());

const secretKey = '64011212016';

// การตั้งค่าการเชื่อมต่อฐานข้อมูล
// const dbConfig = {
//     user: 'APD66_64011212016',
//     password: 'ZX0LE35U',
//     server: '202.28.34.203\\SQLEXPRESS',
//     database: 'APD66_64011212016',
//     options: {
//         encrypt: false,
//         enableArithAbort: true,
//         trustServerCertificate: true,
//         connectTimeout: 60000,
//         requestTimeout: 60000
        
//     }
// };

const dbConfig = {
    user: 'APD66_64011212016',
    password: 'ZX0LE35U',
    server: '202.28.34.203',  // ไม่ใส่ \SQLEXPRESS
    port: 1433,  // ระบุพอร์ต SQL Server ให้แน่นอน
    database: 'APD66_64011212016',
    options: {
        encrypt: false,
        enableArithAbort: true,
        trustServerCertificate: true,
        connectTimeout: 60000,
        requestTimeout: 60000
    }
};




// เชื่อมต่อกับฐานข้อมูล
// sql.connect(dbConfig).then(pool => {
//     if (pool.connected) {
//         console.log('Connected to the database.');
//     }
// }).catch(err => {
//     console.error('Database connection error:', err);
// });

// สร้างตัวแปร pool ให้สามารถเข้าถึงได้ในทุกจุด
let poolPromise;

// เชื่อมต่อกับฐานข้อมูล
sql.connect(dbConfig).then(pool => {
    if (pool.connected) {
        console.log('Connected to the database.');
        poolPromise = pool; // เก็บ pool ไว้ในตัวแปรเพื่อใช้ในที่อื่น
    }
}).catch(err => {
    console.error('Database connection error:', err);
});



const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nookfe9@gmail.com',
        pass: 'vdph ujbs bkoo krcd'
    }
});



// ฟังก์ชันที่สามารถนำมาใช้ซ้ำได้สำหรับการดำเนินการคำสั่ง SQL
function executeQuery(query, inputs, callback) {
    const request = new sql.Request();
    
    // ตั้งค่าข้อมูลที่ต้องการในคำสั่ง SQL
    inputs.forEach(input => {
        request.input(input.name, input.type, input.value);
    });
    
    // ดำเนินการคำสั่ง SQL
    request.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.message, err.code, err);
            return callback(err, null);
        }
        callback(null, result);
    });
}

app.post('/register', async (req, res) => {
    const { img, FL_name, Nickname, Birthday, Province, Email, Password, Phone, Facebook, ID_Line } = req.body;
    
    // Validate required fields
    if (!img || !FL_name || !Nickname || !Birthday || !Province || !Email || !Password || !Phone || !Facebook || !ID_Line) {
        return res.status(400).send('All fields are required.');
    }

    try {
        const request = new sql.Request();
        
        // ตรวจสอบว่า Email นี้มีอยู่ในระบบแล้วหรือไม่
        request.input('Email', sql.VarChar, Email);
        const checkEmailQuery = `SELECT COUNT(*) AS count FROM Users WHERE Email = @Email`;

        const emailResult = await request.query(checkEmailQuery);
        const emailExists = emailResult.recordset[0].count > 0;

        if (emailExists) {
            return res.status(400).send('This email is already registered.');
        }

        // ถ้า Email ไม่ซ้ำ ให้ดำเนินการบันทึกข้อมูลใหม่
        const hashedPassword = await bcrypt.hash(Password, 10);
        
        request.input('img',        sql.VarChar, img);
        request.input('FL_name',    sql.VarChar, FL_name);
        request.input('Nickname',   sql.VarChar, Nickname);
        request.input('Birthday',   sql.VarChar, Birthday);
        request.input('Province',   sql.VarChar, Province);
        request.input('Password',   sql.VarChar, hashedPassword);
        request.input('Phone',      sql.VarChar, Phone);
        request.input('Facebook',   sql.VarChar, Facebook);
        request.input('ID_Line',    sql.VarChar, ID_Line);

        const insertQuery = `
            INSERT INTO Users (img, FL_name, Nickname, Birthday, Province, Email, Password, Phone, Facebook, ID_Line)
            VALUES (@img, @FL_name, @Nickname, @Birthday, @Province, @Email, @Password, @Phone, @Facebook, @ID_Line);
        `;

        // Execute the query
        request.query(insertQuery, (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                res.status(500).send('Server error. Please try again later.');
            } else {
                console.log('Data inserted successfully.');
                res.send('Data inserted successfully.');
            }
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});


// Endpoint สำหรับการเข้าสู่ระบบ
app.post('/login', (req, res) => {
    const { Email, Password } = req.body;
        
    if (!Email || !Password) {
        return res.status(400).send('Email and Password are required.');
    }

    const query = "SELECT ID_user, Password FROM Users WHERE Email = @Email";
    const inputs = [
        { name: 'Email', type: sql.VarChar, value: Email }
    ];
    
    executeQuery(query, inputs, async (err, result) => {
        if (err) {
            console.error('Login query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(401).send('Invalid email or password.');
        }

        const user = result.recordset[0];
        const passwordMatch = await bcrypt.compare(Password, user.Password);
        if (!passwordMatch) {
            return res.status(401).send('Invalid email or password.');
        }
        
        console.log('Login successful.');
        const userId = user.ID_user;
    
        // สร้าง Token
        const token = jwt.sign({ id: userId }, secretKey, { expiresIn: '1h' });
        res.json({ token });
    });
});

app.post('/register-en', async (req, res) => {
    const { ID_user, Email, Password, ConfirmPassword } = req.body;

    if (Password !== ConfirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        // Check if the user already exists
        const checkUser = await sql.query`
            SELECT * FROM Users WHERE Email = ${Email} AND ID_user = ${ID_user}
        `;

        if (checkUser.recordset.length === 0) {
            return res.status(400).send('Invalid ID_user or Email');
        }

        // Validate the password against the stored hash
        const validPassword = await bcrypt.compare(Password, checkUser.recordset[0].Password);
        if (!validPassword) {
            return res.status(400).send('Invalid Password');
        }

        // Insert ID_user into the TypeUser table
        await sql.query`
            INSERT INTO TypeUser (ID_user)
            VALUES (${ID_user})
        `;

        res.send('Registration successful');
    } catch (err) {
        console.error('Error inserting into the database:', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/login-en', async (req, res) => {
    const { Email, Password } = req.body;

    try {
      console.log('Email:', Email, 'Password:', Password);  // เพิ่มการพิมพ์ข้อมูล Email และ Password

    const userResult = await sql.query`
        SELECT ID_user, Password FROM Users WHERE Email = ${Email}
    `;

      console.log('User Result:', userResult.recordset);  // พิมพ์ผลลัพธ์จากฐานข้อมูล

    if (userResult.recordset.length === 0) {
        return res.status(400).json({ message: 'Invalid Email or Password' });
    }

    const { ID_user, Password: hashedPassword } = userResult.recordset[0];

    const isPasswordMatch = await bcrypt.compare(Password, hashedPassword);
    if (!isPasswordMatch) {
        return res.status(400).json({ message: 'Invalid Email or Password' });
    }

    const typeUserResult = await sql.query`
        SELECT * FROM TypeUser WHERE ID_user = ${ID_user}
    `;

      console.log('TypeUser Result:', typeUserResult.recordset);  // พิมพ์ผลลัพธ์จากฐานข้อมูล

    if (typeUserResult.recordset.length === 0) {
        return res.status(400).json({ message: 'User is not authorized' });
    }

    res.status(200).json({ message: 'Login successful', ID_user });
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).json({ message: 'Internal server error' });
    }
});


// Endpoint ใหม่สำหรับการดึงข้อมูลผู้ใช้ตาม ID
app.get('/users/:id', (req, res) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).send('ID_user is required.');
    }

    const query = "SELECT * FROM Users WHERE ID_user = @ID_user";
    const inputs = [
        { name: 'ID_user', type: sql.Int, value: id }
    ];
    
    executeQuery(query, inputs, (err, result) => {
        if (err) {
            console.error('Get user query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(404).send('User not found.');
        }
        
        res.json(result.recordset[0]);
    });
});

// Endpoint to get all concerts for a specific user
app.get('/concerts/:id_user', (req, res) => {
    const { id_user } = req.params;

    if (!id_user) {
        return res.status(400).send('ID_user is required.');
    }

    const query = "SELECT * FROM Concerts WHERE ID_user = @ID_user ORDER BY CID DESC";
    const inputs = [
        { name: 'ID_user', type: sql.Int, value: id_user }
    ];

    executeQuery(query, inputs, (err, result) => {
        if (err) {
            console.error('Get concerts query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(404).send('Concerts not found for this user.');
        }

        res.json(result.recordset);
    });
});

// Endpoint to get all concerts for a specific user
app.get('/detailconcerts/:id_user/:cid', (req, res) => {
    const { id_user, cid } = req.params;

    if (!id_user || !cid) {
        return res.status(400).send('ID_user and CID are required.');
    }

    const query = `
        SELECT      Concerts.CID, Show_secheduld, Poster, Name, Address, NameTC, NameTS, Time, Type, Ticket_zone, Price, Detail, LineUP,
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
        FROM        Concerts
        JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
        JOIN        TicketInform    ON ShowTime.CID         = TicketInform.CID
        JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_con
        JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
        WHERE       Concerts.ID_user = @ID_user AND Concerts.CID = @CID
    `;
    const inputs = [
        { name: 'ID_user',  type: sql.Int, value: id_user },
        { name: 'CID',      type: sql.Int, value: cid }
    ];

    executeQuery(query, inputs, (err, result) => {
        if (err) {
            console.error('Get concerts query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(404).send('Concerts not found for this user and CID.');
        }

        res.json(result.recordset);
    });
});

app.post('/addchanel', async (req, res) => {
    const { CID, Url } = req.body;

    // Validate required fields
    if (!CID || !Url) {
        return res.status(400).send('CID and Url are required.');
    }

    try {
        const request = new sql.Request();

        // Set parameters for SQL query
        request.input('CID', sql.Int, CID);
        request.input('Url', sql.VarChar, Url);

        // SQL query to insert data into ChanelConcerts table
        const query = `
            INSERT INTO ChanelConcerts (CID, Url)
            VALUES (@CID, @Url);
        `;

        // Execute the query
        request.query(query, (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                res.status(500).send('Server error. Please try again later.');
            } else {
                console.log('Data inserted successfully.');
                res.send('Data inserted successfully.');
            }
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.post('/showtime', async (req, res) => {
    const { CID, Time } = req.body;

    // Validate required fields
    if (!CID || !Time) {
        return res.status(400).send('CID and Time are required.');
    }

    try {
        const request = new sql.Request();

        // Set parameters for SQL query
        request.input('CID', sql.Int, CID);
        request.input('Time', sql.VarChar, Time);

        // SQL query to insert data into ShowTime table
        const query = `
            INSERT INTO ShowTime (CID, Time)
            VALUES (@CID, @Time);
        `;

        // Execute the query
        request.query(query, (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                res.status(500).send('Server error. Please try again later.');
            } else {
                console.log('Data inserted successfully.');
                res.send('Data inserted successfully.');
            }
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});


// Endpoint to add a ticket
app.post('/addticket', async (req, res) => {
    const { CID, Ticket_zone, Price, Type, Date } = req.body;

    // Validate required fields
    if (!CID || !Ticket_zone || !Price || !Type || !Date) {
        return res.status(400).send('All fields are required.');
    }

    try {
        // Check if CID exists in Concerts table
        const checkCIDQuery = `
            SELECT COUNT(*) AS count FROM Concerts WHERE CID = @CID
        `;
        const checkCIDRequest = new sql.Request();
        checkCIDRequest.input('CID', sql.Int, CID);
        const checkCIDResult = await checkCIDRequest.query(checkCIDQuery);

        if (checkCIDResult.recordset[0].count === 0) {
            return res.status(400).send('CID does not exist in Concerts table.');
        }

        // Proceed with inserting into TicketInform table
        const request = new sql.Request();

        // SQL query to insert data into TicketInform table
        const insertQuery = `
            INSERT INTO TicketInform (CID, Ticket_zone, Price, Type, Date)
            VALUES (@CID, @Ticket_zone, @Price, @Type, @Date);
        `;

        // Set parameters for SQL query
        request.input('CID', sql.Int, CID);
        request.input('Ticket_zone', sql.VarChar, Ticket_zone);
        request.input('Price', sql.Int, Price);
        request.input('Type', sql.VarChar, Type); // Change sql.Int to sql.VarChar for Type
        request.input('Date', sql.Date, Date);

        // Execute the query
        const result = await request.query(insertQuery);

        console.log('Data inserted successfully.');
        res.send('Data inserted successfully.');
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});



// Endpoint to get all concerts for a specific user
app.get('/concertsU', async (req, res) => {
    const { id_user, search } = req.query;

    let query = `
        SELECT  DISTINCT Poster, Name, Address, Concerts.CID, NameTC, NameTS, NameT, Deal_Status, 
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
        FROM        Concerts
        JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_Con
        JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
        JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
        JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
        JOIN        TypeTicket      ON TicketInform.Type    = TypeTicket.TID
        LEFT JOIN   ConcertDeals    ON Concerts.CID         = ConcertDeals.CID
        LEFT JOIN   Deals           ON ConcertDeals.CDID    = Deals.CDID
        LEFT JOIN   IncidentStatus  ON Deals.StatusD        = IncidentStatus.ISID
        WHERE       Concerts.ID_user = @id_user
    `;

    const inputs = [{ name: 'id_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name        LIKE @search OR
                Address     LIKE @search OR
                NameTC      LIKE @search OR
                NameTS      LIKE @search OR
                Price       LIKE @search OR
                NameT       LIKE @search OR
                Deal_Status LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.delete('/concerts', async (req, res) => {
    const { CID, ID_user } = req.body;

    // ตรวจสอบว่ามีการส่ง CID และ ID_user มาใน req.body
    if (CID == null || ID_user == null) {
        return res.status(400).send('CID and ID_user are required');
    }

    try {
        let pool = await sql.connect(dbConfig);

        // ตรวจสอบก่อนลบโดยใช้ SELECT เพื่อเช็คข้อมูลที่เกี่ยวข้อง
        let selectResult = await pool.request()
            .input('CID', sql.Int, CID)
            .query(`
                SELECT      Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                            Packeage.ID_deals, Hotels.ID_hotel, Concerts.CID
                FROM        Packeage
                JOIN        Deals           ON Packeage.ID_deals    = Deals.ID_deals
                JOIN        HotelDeals      ON Deals.HDID           = HotelDeals.HDID
                JOIN        RoomHotel       ON HotelDeals.ID_room   = RoomHotel.ID_room
                JOIN        Hotels          ON RoomHotel.ID_hotel   = Hotels.ID_hotel
                JOIN        ConcertDeals    ON Deals.CDID           = ConcertDeals.CDID
                JOIN        Concerts        ON ConcertDeals.CID     = Concerts.CID
                JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
                WHERE       Concerts.CID    = @CID
                AND         Deals.StatusD   = 2
                GROUP BY    Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                            Packeage.ID_deals, Hotels.ID_hotel, Concerts.CID
            `);

        // ถ้าพบข้อมูลที่เกี่ยวข้อง ให้ออกคำตอบว่าไม่สามารถลบได้
        if (selectResult.recordset.length > 0) {
            return res.status(400).send('Related data found. Cannot delete.');
        }

        // ลบข้อมูลจากตาราง ShowTime ที่เกี่ยวข้องกับ CID
        await pool.request()
            .input('CID', sql.Int, CID)
            .query('DELETE FROM ShowTime WHERE CID = @CID');

        // ลบข้อมูลจากตาราง ChanelConcerts ที่เกี่ยวข้องกับ CID
        await pool.request()
            .input('CID', sql.Int, CID)
            .query('DELETE FROM ChanelConcerts WHERE CID = @CID');

        // ลบข้อมูลจากตาราง TicketInform ที่เกี่ยวข้องกับ CID
        await pool.request()
            .input('CID', sql.Int, CID)
            .query('DELETE FROM TicketInform WHERE CID = @CID');

        // ลบข้อมูลจากตาราง Concerts
        let result = await pool.request()
            .input('CID', sql.Int, CID)
            .input('ID_user', sql.Int, ID_user)
            .query(`
                        DELETE FROM Concerts WHERE CID = @CID AND ID_user = @ID_user
                        DELETE FROM ConcertDeals WHERE CID = @CID
                    `);

        // ตรวจสอบว่ามีการลบข้อมูลหรือไม่
        if (result.rowsAffected[0] > 0) {
            res.send(`Deleted ${result.rowsAffected[0]} row(s)`);
        } else {
            res.status(404).send('No matching records found to delete');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting the concert');
    }
});



app.post('/editconcerts', async (req, res) => {
    const { CID, ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Quantity_date, Address, Detail, Per_type, StartDate, EndDate } = req.body;

    // Validate required fields
    if (!CID || !ID_user || !Show_secheduld || !Poster || !Name || !LineUP || !Con_type  || !Quantity_date || !Address || !Detail || !Per_type || !StartDate || !EndDate) {
        return res.status(400).send('All fields are required.');
    }

    // Ensure CID and Quantity_date are numbers
    const numericCID = parseInt(CID, 10);
    const numericQuantityDate = parseInt(Quantity_date, 10);

    if (isNaN(numericCID)) {
        return res.status(400).send('CID must be a valid number.');
    }
    if (isNaN(numericQuantityDate)) {
        return res.status(400).send('Quantity_date must be a valid number.');
    }

    try {
        const request = new sql.Request();

        // Set parameters for SQL query
        request.input('CID',            sql.Int,        numericCID);
        request.input('ID_user',        sql.Int,        ID_user);
        request.input('Show_secheduld', sql.VarChar,    Show_secheduld);
        request.input('Poster',         sql.VarChar,    Poster);
        request.input('Name',           sql.VarChar,    Name);
        request.input('LineUP',         sql.Text,       LineUP);
        request.input('Con_type',       sql.Int,        parseInt(Con_type, 10)); // Ensure Con_type is an integer
        request.input('Quantity_date',  sql.Int,        numericQuantityDate);
        request.input('Address',        sql.VarChar,    Address);
        request.input('Detail',         sql.Text,       Detail);
        request.input('Per_type',       sql.Int,        parseInt(Per_type, 10)); // Ensure Per_type is an integer
        request.input('StartDate',      sql.Date,       StartDate);
        request.input('EndDate',        sql.Date,       EndDate);

        // Verify the ID_user matches the CID
        const verifyQuery = 'SELECT ID_user FROM Concerts WHERE CID = @CID';
        const verifyResult = await request.query(verifyQuery);

        if (verifyResult.recordset.length === 0) {
            return res.status(404).send('No concert found with the given CID.');
        }

        const concert = verifyResult.recordset[0];

        if (concert.ID_user !== ID_user) {
            return res.status(403).send('Unauthorized: ID_user does not match.');
        }

        // SQL query to update data in Concerts table
        const updateQuery = `
            UPDATE Concerts
            SET Show_secheduld  = @Show_secheduld, 
                Poster          = @Poster, 
                Name            = @Name, 
                LineUP          = @LineUP, 
                Con_type        = @Con_type, 
                Quantity_date   = @Quantity_date, 
                Address         = @Address, 
                Detail          = @Detail, 
                Per_type        = @Per_type,
                StartDate       = @StartDate,
                EndDate         = @EndDate
            WHERE CID = @CID AND ID_user = @ID_user
        `;

        // Execute the query
        request.query(updateQuery, (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                res.status(500).send('Server error. Please try again later.');
            } else if (result.rowsAffected[0] === 0) {
                res.status(404).send('No concert found with the given CID and ID_user.');
            } else {
                console.log('Data updated successfully.');
                res.send('Data updated successfully.');
            }
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/detailshowtime', async (req, res) => {
    const { CID } = req.query;

    // ตรวจสอบข้อมูล
    if (!CID) {
        return res.status(400).send('CID is required.');
    }

    try {
        const request = new sql.Request();

        // ตั้งค่าพารามิเตอร์สำหรับคำสั่ง SQL
        request.input('CID', sql.Int, CID);

        // คำสั่ง SQL เพื่อดึงข้อมูลจากตาราง ShowTime
        const query = `
            SELECT * FROM ShowTime WHERE CID = @CID;
        `;

        // รันคำสั่ง SQL
        request.query(query, (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                res.status(500).send('Server error. Please try again later.');
            } else {
                if (result.recordset.length > 0) {
                    res.json(result.recordset[0]);
                } else {
                    res.status(404).send('No data found for the provided CID.');
                }
            }
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.get('/tickets/:CID', async (req, res) => {
    const { CID } = req.params;

    if (!CID) {
        return res.status(400).send('Please provide CID');
    }

    try {
        const result = await sql.query`
            SELECT *
            FROM TicketInform
            WHERE CID = ${CID}
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching ticket information:', err);
        res.status(500).send('Internal server error');
    }
});


app.put('/updateticket/:CID', async (req, res) => {
    const { CID } = req.params;
    const { Ticket_zone, Price, Type, Date } = req.body;

    // Validate required fields
    if (!CID || !Ticket_zone || !Price || !Type || !Date) {
        return res.status(400).send('All fields are required.');
    }

    try {
        await sql.connect(dbConfig);
        // Check if CID exists in Concerts table
        const checkCIDQuery = `
            SELECT COUNT(*) AS count FROM Concerts WHERE CID = @CID
        `;
        const checkCIDRequest = new sql.Request();
        checkCIDRequest.input('CID', sql.Int, CID);
        const checkCIDResult = await checkCIDRequest.query(checkCIDQuery);

        if (checkCIDResult.recordset[0].count === 0) {
            return res.status(400).send('CID does not exist in Concerts table.');
        }

        // Proceed with updating the TicketInform table
        const request = new sql.Request();

        // SQL query to update data in TicketInform table
        const updateQuery = `
            UPDATE  TicketInform
            SET     Ticket_zone = @Ticket_zone, Price = @Price, Type = @Type, Date = @Date
            WHERE   CID = @CID
        `;

        // Set parameters for SQL query
        request.input('CID', sql.Int, CID);
        request.input('Ticket_zone', sql.VarChar, Ticket_zone);
        request.input('Price', sql.Int, Price);
        request.input('Type', sql.Int, Type);
        request.input('Date', sql.Date, Date);

        // Execute the query
        const result = await request.query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('No tickets found for the given CID.');
        }

        console.log('Data updated successfully.');
        res.send('Data updated successfully.');
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.post('/hotels', async (req, res) => {
    const { ID_user, Type_hotel, NameH, AddressH, DetailH } = req.body;

    // Validate required fields
    if (!ID_user || !Type_hotel || !NameH || !AddressH || !DetailH ) {
        return res.status(400).send('All fields are required.');
    }

    try {
        const request = new sql.Request();
        
        // Set parameters for SQL query
        request.input('ID_user', sql.Int, ID_user);
        request.input('Type_hotel', sql.VarChar, Type_hotel);
        request.input('NameH', sql.VarChar, NameH);
        request.input('AddressH', sql.VarChar, AddressH);
        request.input('DetailH', sql.Text, DetailH);
        // Verify ID_user exists
        const verifyQuery = 'SELECT COUNT(*) AS userCount FROM Users WHERE ID_user = @ID_user';
        
        const verifyResult = await request.query(verifyQuery);
        
        if (verifyResult.recordset[0].userCount === 0) {
            return res.status(404).send('No user found with the given ID_user.');
        }

        // SQL query to insert data into Hotels table and return ID_hotel
        const insertQuery = `
            INSERT INTO Hotels (ID_user, Type_hotel, NameH, AddressH, DetailH)
            OUTPUT INSERTED.ID_hotel
            VALUES (@ID_user, @Type_hotel, @NameH, @AddressH, @DetailH)
        `;

        // Execute the query and get the inserted ID_hotel
        const insertResult = await request.query(insertQuery);
        const ID_hotel = insertResult.recordset[0].ID_hotel;

        res.status(201).json({ ID_hotel });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.post('/hotelpicture', async (req, res) => {
    const { ID_hotel, Img_Url_Hotel } = req.body;

    if (!ID_hotel || !Array.isArray(Img_Url_Hotel) || Img_Url_Hotel.length === 0) {
        return res.status(400).send('ID_hotel and Img_Url_Hotel array are required.');
    }

    try {
        const request = new sql.Request();
        request.input('ID_hotel', sql.Int, ID_hotel);

        const verifyQuery = 'SELECT COUNT(*) AS hotelCount FROM Hotels WHERE ID_hotel = @ID_hotel';
        const verifyResult = await request.query(verifyQuery);

        if (verifyResult.recordset[0].hotelCount === 0) {
            return res.status(404).send('No hotel found with the given ID_hotel.');
        }

        const transaction = new sql.Transaction();
        await transaction.begin();

        for (const imgUrl of Img_Url_Hotel) {
            const transactionRequest = new sql.Request(transaction);
            transactionRequest.input('ID_hotel', sql.Int, ID_hotel);
            transactionRequest.input('Img_Url_Hotel', sql.VarChar, imgUrl);
            const insertQuery = `
                INSERT INTO HotelPicture (ID_hotel, Img_Url_Hotel)
                VALUES (@ID_hotel, @Img_Url_Hotel)
            `;
            await transactionRequest.query(insertQuery);
        }

        await transaction.commit();
        res.send('Image URLs inserted successfully.');
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.post('/roomhotel', async (req, res) => {
    const { ID_hotel, Type_view, PriceH, Status_room, Type_room, NRoom } = req.body;

    console.log('Received request body:', req.body); // สำหรับดีบัก

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!ID_hotel || typeof ID_hotel !== 'number') {
        return res.status(400).send('ID_hotel is required and must be a number.');
    }
    if (!Type_view || typeof Type_view !== 'number') {
        return res.status(400).send('Type_view is required and must be a number.');
    }
    if (!PriceH || typeof PriceH !== 'number') {
        return res.status(400).send('PriceH is required and must be a number.');
    }
    if (!Status_room || typeof Status_room !== 'string') {
        return res.status(400).send('Status_room is required and must be a string.');
    }
    if (!Type_room || typeof Type_room !== 'number') {
        return res.status(400).send('Type_room is required and must be a number.');
    }
    if (!NRoom || typeof NRoom !== 'number') {
        return res.status(400).send('NRoom is required and must be a number.');
    }

    try {
        const request = new sql.Request();

        // ตรวจสอบว่า ID_hotel มีอยู่ในฐานข้อมูล
        request.input('ID_hotel', sql.Int, ID_hotel);
        const verifyQuery = 'SELECT COUNT(*) AS hotelCount FROM Hotels WHERE ID_hotel = @ID_hotel';
        const verifyResult = await request.query(verifyQuery);

        if (verifyResult.recordset[0].hotelCount === 0) {
            return res.status(404).send('No hotel found with the given ID_hotel.');
        }

        // ตั้งค่าพารามิเตอร์สำหรับการ query
        request.input('Type_view', sql.Int, Type_view);
        request.input('PriceH', sql.Int, PriceH);
        request.input('Status_room', sql.VarChar, Status_room);
        request.input('Type_room', sql.Int, Type_room);
        request.input('NRoom', sql.Int, NRoom);

        // สร้าง SQL query สำหรับการเพิ่มข้อมูลห้องพักและดึง ID_room ที่ถูกเพิ่ม
        const insertQuery = `
            INSERT INTO RoomHotel (ID_hotel, Type_view, PriceH, Status_room, Type_room, NRoom)
            OUTPUT inserted.ID_room
            VALUES (@ID_hotel, @Type_view, @PriceH, @Status_room, @Type_room, @NRoom)
        `;

        // Execute the query
        const insertResult = await request.query(insertQuery);
        const ID_room = insertResult.recordset[0].ID_room;

        // ส่ง response กลับเป็น JSON พร้อม ID_room ที่ถูกเพิ่ม
        return res.status(201).json({ ID_room });
    } catch (err) {
        console.error('Error:', err);
        return res.status(500).send('Server error. Please try again later.');
    }
});





app.post('/roomPictures', async (req, res) => {
    const { Img_Url_Room, ID_room } = req.body;

    if (!Img_Url_Room || !ID_room) {
        return res.status(400).send('Img_Url_Room and ID_room are required');
    }

    try {
        // เพิ่มข้อมูลลงในตาราง RoomlPicture
        await sql.query`
            INSERT INTO RoomlPicture (Img_Url_Room, ID_room)
            VALUES (${Img_Url_Room}, ${ID_room})
        `;
        res.send('Image URL added successfully');
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/addchanelhotel', async (req, res) => {
    const { ID_hotel, UrlH } = req.body;

    if (!ID_hotel || !UrlH) {
        return res.status(400).send('ID_hotel and UrlH are required');
    }

    try {
        let pool = await sql.connect(dbConfig);

        // Check if ID_hotel exists in the Hotel table
        let hotelCheck = await pool.request()
            .input('ID_hotel', sql.Int, ID_hotel)
            .query('SELECT COUNT(*) AS count FROM Hotels WHERE ID_hotel = @ID_hotel');
        
        if (hotelCheck.recordset[0].count === 0) {
            return res.status(404).send('Hotel ID not found');
        }

        // Insert new record into ChanelHotel
        await pool.request()
            .input('ID_hotel', sql.Int, ID_hotel)
            .input('UrlH', sql.VarChar, UrlH)
            .query('INSERT INTO ChanelHotel (ID_hotel, UrlH) VALUES (@ID_hotel, @UrlH)');

        res.send('ChanelHotel record added successfully');
    } catch (err) {
        console.error('Error adding ChanelHotel record:', err); // Log the full error object
        res.status(500).send('Error adding ChanelHotel record: ' + err.message); // Send a detailed error message
    }
});

// Endpoint to get all hotels for a specific user
app.get('/hotelU/:id_user', (req, res) => {
    const { id_user } = req.params;
    const { search } = req.query; // รับค่า search จาก query parameter

    if (!id_user) {
        return res.status(400).send('ID_user is required.');
    }

    let query = `
        WITH HotelDealsInfo AS (
                    SELECT		Hotels.ID_hotel, MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel, 
                                Hotels.NameH, Hotels.AddressH, TypeHotel.NameTH AS NameTH,
                                TypeRoom.NameTR AS NameTR, TypeView.NameTV AS NameTV, RoomStatus.NameRS AS NameRS,
                                MAX(Deal_Status) AS Deal_Status, MAX(Deals.ID_deals) AS ID_deals,
                                ROW_NUMBER() OVER (PARTITION BY Hotels.ID_hotel ORDER BY Deal_Status DESC) AS RowNum
                    FROM		Hotels
                    JOIN		TypeHotel		ON Hotels.Type_hotel		= TypeHotel.ID_Type_Hotel
                    JOIN		HotelPicture	ON Hotels.ID_hotel			= HotelPicture.ID_hotel
                    LEFT JOIN	RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
                    LEFT JOIN	TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                    LEFT JOIN	TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                    LEFT JOIN	RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
                    LEFT JOIN	HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                    LEFT JOIN	Deals			ON HotelDeals.HDID			= Deals.HDID
                    LEFT JOIN	IncidentStatus	ON Deals.StatusD			= IncidentStatus.ISID
                    WHERE		Hotels.ID_user = @ID_user
                    GROUP BY	Hotels.ID_hotel, Hotels.NameH, Hotels.AddressH, TypeHotel.NameTH,
                                TypeRoom.NameTR, TypeView.NameTV, RoomStatus.NameRS, Deal_Status, Deals.ID_deals
        )
        
        SELECT		Img_Url_Hotel, ID_hotel, NameH, AddressH, NameTH, NameTR, NameTV, NameRS, Deal_Status, ID_deals
        FROM		HotelDealsInfo
        WHERE		RowNum = 1
    `;

    const inputs = [
        { name: 'ID_user', type: sql.Int, value: id_user }
    ];

    // เพิ่มเงื่อนไขการค้นหาเมื่อมี search query
    if (search) {
        query += `
            AND (
                    NameH               LIKE @search OR
                    AddressH            LIKE @search OR
                    NameTH              LIKE @search OR
                    NameTR              LIKE @search OR
                    NameTV              LIKE @search OR
                    NameRS              LIKE @search OR
                    Deal_Status         LIKE @search
                )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    query += ` ORDER BY ID_hotel;`;

    executeQuery(query, inputs, (err, result) => {
        if (err) {
            console.error('Get hotels query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(404).send('Hotels not found for this user.');
        }

        res.json(result.recordset);
    });
});



app.get('/pictures/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
        const hotelPicturesResult = await sql.query`SELECT Img_Url_Hotel FROM HotelPicture WHERE ID_hotel = ${ID_hotel}`;
        const hotelPictures = hotelPicturesResult.recordset;

        const roomPicturesResult = await sql.query` SELECT  RoomlPicture.Img_Url_Room 
                                                    FROM    RoomlPicture, RoomHotel 
                                                    WHERE   RoomHotel.ID_hotel  = ${ID_hotel}
                                                    AND     RoomHotel.ID_room   = RoomlPicture.ID_room`;
        const roomPictures = roomPicturesResult.recordset;

        const pictures = {
            hotelPictures: hotelPictures,
            roomPictures: roomPictures
        };

        res.json(pictures);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});



// Endpoint สำหรับดึงข้อมูลจากทั้งสองตารางโดยเช็คจาก ID_hotel
app.get('/detailhotels/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
      // Query ข้อมูลจาก Hotels และ RoomHotel รวมกันทีเดียว
    const result = await sql.query`
        SELECT      h.*, r.*
        FROM        Hotels h
        LEFT JOIN   RoomHotel r ON h.ID_hotel = r.ID_hotel
        WHERE       h.ID_hotel = ${ID_hotel}
    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

app.get('/chanelhotel/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
      // Query data from ChanelHotel
    const result = await sql.query`SELECT UrlH FROM ChanelHotel WHERE ID_hotel = ${ID_hotel}`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับดึงข้อมูลจาก ChanelConcerts โดยเช็คจาก CID
app.get('/chanelconcerts/:CID', async (req, res) => {
    const CID = req.params.CID;
    try {
      // Query ข้อมูลจาก ChanelConcerts
    const result = await sql.query`SELECT Url FROM ChanelConcerts WHERE CID = ${CID}`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});


app.post('/chanelconcerts/:CID', async (req, res) => {
    const CID = req.params.CID;
    const { channels } = req.body; // Expecting an array of channel URLs

    try {
        // Clear existing entries for the given CID
        await sql.query`DELETE FROM ChanelConcerts WHERE CID = ${CID}`;

        // Insert new entries
        for (let channel of channels) {
            await sql.query`INSERT INTO ChanelConcerts (CID, Url) VALUES (${CID}, ${channel})`;
        }

        res.send('Channels updated successfully');
    } catch (err) {
        console.error('Error updating the database:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับดึงข้อมูลทั้งหมดจาก Hotels โดยเช็คจาก ID_hotel
app.get('/hotels/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
        // Query ข้อมูลจาก Hotels
        const result = await sql.query`SELECT * FROM Hotels WHERE ID_hotel = ${ID_hotel}`;
        res.json(result.recordset[0]); // ส่ง object แทน array กลับไป
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

app.put('/hotels/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    const { NameH, AddressH, Type_hotel, DetailH } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!NameH || !AddressH || !Type_hotel || !DetailH) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Query อัพเดทข้อมูลใน Hotels
        await sql.query`
            UPDATE  Hotels
            SET     NameH = ${NameH}, AddressH = ${AddressH}, Type_hotel = ${Type_hotel}, DetailH = ${DetailH}
            WHERE   ID_hotel = ${ID_hotel}
        `;

        res.send('Update successful');
    } catch (err) {
        console.error('Error updating the database:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับดึงข้อมูลทั้งหมดจาก RoomHotel โดยเช็คจาก ID_hotel
app.get('/roomhotel/:ID_room', async (req, res) => {
    const ID_room = req.params.ID_room;
    try {
      // Query ข้อมูลจาก RoomHotel
      const result = await sql.query`SELECT * FROM RoomHotel WHERE ID_room = ${ID_room}`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});


app.put('/roomhotel/:ID_room', async (req, res) => {
    const ID_room = req.params.ID_room;
    const { Type_view, Status_room, PriceH, NRoom } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!Type_view || !Status_room || !PriceH || !NRoom) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // สร้างการเชื่อมต่อกับฐานข้อมูล
        const pool = await sql.connect('your-connection-string-here');
        
        // ได้รับเวลาในปัจจุบัน
        const currentTime = await pool.request().query(`SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') as CurrentTime`);
        const startRoom = currentTime.recordset[0].CurrentTime;

        // Query อัพเดทข้อมูลใน RoomHotel
        const result = await pool.request()
            .input('Type_view', sql.Int, Type_view)
            .input('Status_room', sql.Int, Status_room)
            .input('PriceH', sql.Int, PriceH)
            .input('StartRoom', sql.Date, startRoom)
            .input('NRoom', sql.Int, NRoom)
            .input('ID_room', sql.Int, ID_room)
            .query(`
                UPDATE RoomHotel
                SET Type_view   = @Type_view, 
                    Status_room = @Status_room, 
                    PriceH      = @PriceH,
                    NRoom       = @NRoom
                WHERE ID_room = @ID_room
            `);
        
        // ตรวจสอบผลลัพธ์ของการอัพเดท
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('Room not found');
        }

        res.send('Update successful');
    } catch (err) {
        console.error('Error updating the database:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/chanelhotel/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    const { channels } = req.body; // Expecting an array of channel URLs

    try {
        // Clear existing entries for the given ID_hotel
        await sql.query`DELETE FROM ChanelHotel WHERE ID_hotel = ${ID_hotel}`;

        // Insert new entries
        for (let channel of channels) {
            await sql.query`INSERT INTO ChanelHotel (ID_hotel, UrlH) VALUES (${ID_hotel}, ${channel})`;
        }

        res.send('Channels updated successfully');
    } catch (err) {
        console.error('Error updating the database:', err);
        res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับดึงข้อมูล Img_Url_Hotel จาก HotelPicture โดยเช็คจาก ID_hotel
app.get('/hotelpicture/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
      // Use parameterized query
    const result = await sql.query`SELECT Img_Url_Hotel FROM HotelPicture WHERE ID_hotel = ${ID_hotel}`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});


app.post('/hotelpicture/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    const { channels } = req.body; // Expecting an array of channel URLs

    try {
        // Clear existing entries for the given ID_hotel
        await sql.query`DELETE FROM HotelPicture WHERE ID_hotel = ${ID_hotel}`;

        // Insert new entries
        for (let channel of channels) {
            await sql.query`INSERT INTO HotelPicture (ID_hotel, Img_Url_Hotel) VALUES (${ID_hotel}, ${channel})`;
        }

        res.send('Channels updated successfully');
    } catch (err) {
        console.error('Error updating the database:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับดึงข้อมูล Img_Url_Hotel จาก RoomlPicture โดยเช็คจาก ID_hotel
app.get('/roompicture/:ID_room', async (req, res) => {
    const ID_room = req.params.ID_room;
    try {
      // Use parameterized query
    const result = await sql.query` SELECT  RoomlPicture.Img_Url_Room 
                                    FROM    RoomlPicture, RoomHotel 
                                    WHERE   RoomHotel.ID_room = ${ID_room}
                                    AND     RoomHotel.ID_room = RoomlPicture.ID_room`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

app.post('/roompicture/:ID_room', async (req, res) => {
    const ID_room = req.params.ID_room;
    const { channels } = req.body; // Expecting an array of channel URLs

    try {

        // Clear existing entries for the found ID_room
        await sql.query`DELETE FROM RoomlPicture WHERE ID_room = ${ID_room}`;

        // Insert new entries
        for (let channel of channels) {
            await sql.query`INSERT INTO RoomlPicture (ID_room, Img_Url_Room) VALUES (${ID_room}, ${channel})`;
        }

        res.send('Channels updated successfully');
    } catch (err) {
        console.error('Error updating the database:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับอัพเดทข้อมูลใน Users โดยเช็คจาก ID_user
app.put('/users/:ID_user', async (req, res) => {
    const ID_user = req.params.ID_user;
    const { Nickname, img, FL_name, Province, Phone, Birthday, Facebook, ID_Line } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!Nickname || !img || !FL_name || !Province || !Phone || !Birthday || !Facebook || !ID_Line) {
    return res.status(400).send('Missing required fields');
    }

    try {
      // Query อัพเดทข้อมูลใน Users
    await sql.query`
        UPDATE Users
        SET Nickname = ${Nickname}, img = ${img}, FL_name = ${FL_name}, Province = ${Province}, Phone = ${Phone}, Birthday = ${Birthday}, Facebook = ${Facebook}, ID_Line = ${ID_Line}
        WHERE ID_user = ${ID_user}
    `;

    res.send('Update successful');
    } catch (err) {
    console.error('Error updating the database:', err);
    res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับเพิ่มข้อมูลใน ConcertDeals โดยเช็คจาก CID
app.post('/concertdeals', async (req, res) => {
    const { CID, Number_of_ticket, S_datetime, E_datetime, StatusCD, PriceCD } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!CID || !Number_of_ticket || !S_datetime || !E_datetime || !StatusCD || !PriceCD) {
    return res.status(400).send('Missing required fields');
    }

    try {
      // Query เพิ่มข้อมูลใน ConcertDeals
    await sql.query`
        INSERT INTO ConcertDeals (CID, Number_of_ticket, S_datetime, E_datetime, StatusCD, PriceCD)
        VALUES (${CID}, ${Number_of_ticket}, ${S_datetime}, ${E_datetime}, ${StatusCD}, ${PriceCD})
    `;

    res.send('Insert successful');
    } catch (err) {
    console.error('Error inserting into the database:', err);
    res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับดึงข้อมูลจาก Concerts และ ConcertDeals โดยเช็คจาก CID
app.get('/concertsdeals-approve/:CID', async (req, res) => {
    const CID = req.params.CID;
    try {
      // Query ข้อมูลจาก Concerts และ ConcertDeals
    const result = await sql.query`
        SELECT  *
        FROM    Concerts, ConcertDeals
        WHERE   Concerts.CID = ${CID}
        AND     Concerts.CID = ConcertDeals.CID
        AND     ConcertDeals.StatusCD = 2
    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับดึงข้อมูลจาก Concerts และ ConcertDeals โดยเช็คจาก CID
app.get('/concertsdeals-not-approved/:CID', async (req, res) => {
    const CID = req.params.CID;
    try {
      // Query ข้อมูลจาก Concerts และ ConcertDeals
    const result = await sql.query`
        SELECT  Concerts.CID, ConcertDeals.CDID, Poster, Name, S_datetime, E_datetime, Number_of_ticket, PriceCD,
                CASE 
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(CAST(S_datetime AS DATE), 'dd') + ' ' +
                CASE 
                    WHEN MONTH(S_datetime) = 1 THEN 'มกราคม' 
                    WHEN MONTH(S_datetime) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(S_datetime) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(S_datetime) = 4 THEN 'เมษายน' 
                    WHEN MONTH(S_datetime) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(S_datetime) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(S_datetime) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(S_datetime) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(S_datetime) = 9 THEN 'กันยายน' 
                    WHEN MONTH(S_datetime) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(S_datetime) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(S_datetime) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(S_datetime) + 543 AS NVARCHAR) AS S_datetime_TH, 

                CASE 
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(CAST(E_datetime AS DATE), 'dd') + ' ' +
                CASE 
                    WHEN MONTH(E_datetime) = 1 THEN 'มกราคม' 
                    WHEN MONTH(E_datetime) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(E_datetime) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(E_datetime) = 4 THEN 'เมษายน' 
                    WHEN MONTH(E_datetime) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(E_datetime) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(E_datetime) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(E_datetime) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(E_datetime) = 9 THEN 'กันยายน' 
                    WHEN MONTH(E_datetime) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(E_datetime) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(E_datetime) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(E_datetime) + 543 AS NVARCHAR) AS E_datetime_TH
        FROM    Concerts, ConcertDeals
        WHERE   Concerts.CID = ${CID}
        AND     Concerts.CID = ConcertDeals.CID
        AND     ConcertDeals.StatusCD = 1
    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

app.get('/concertdeals-cdid/:CDID', async (req, res) => {
    const CDID = req.params.CDID;
    try {
        // Query information from ConcertDeals
        const result = await sql.query`
            SELECT *
            FROM ConcertDeals
            WHERE CDID = ${CDID}
        `;
        res.json(result.recordset[0]); // Assuming CDID is unique and returns one record
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับอัพเดทข้อมูลใน ConcertDeals โดยเช็คจาก CDID
app.put('/concertdeals-cdid/:CDID', async (req, res) => {
    const CDID = req.params.CDID;
    const { Number_of_ticket, S_datetime, E_datetime, PriceCD } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!Number_of_ticket || !S_datetime || !E_datetime || !PriceCD ) {
    return res.status(400).send('Missing required fields');
    }

    try {
      // Query อัพเดทข้อมูลใน ConcertDeals
    await sql.query`
        UPDATE ConcertDeals
        SET Number_of_ticket = ${Number_of_ticket}, S_datetime = ${S_datetime}, E_datetime = ${E_datetime}, PriceCD = ${PriceCD}
        WHERE CDID = ${CDID}
    `;

    res.send('Update successful');
    } catch (err) {
    console.error('Error updating the database:', err);
    res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับเพิ่มข้อมูลใน HotelDeals โดยเช็คจาก ID_hotel
app.post('/hoteldeals', async (req, res) => {
    const { ID_room, Number_of_room, S_datetimeHD, E_datetimeHD, StatusHD, Total } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!ID_room || !Number_of_room || !S_datetimeHD || !E_datetimeHD || !StatusHD || !Total) {
        return res.status(400).send('Missing required fields');
    }

    try {
        console.log('Data received:', req.body);
        // Query เพื่อดึง NRoom จาก RoomHotel
        const result = await sql.query`
            SELECT NRoom FROM RoomHotel WHERE ID_room = ${ID_room}
        `;
        
        // ตรวจสอบว่าพบห้องหรือไม่
        if (result.recordset.length === 0) {
            return res.status(404).send('Room not found');
        }

        const NRoom = result.recordset[0].NRoom;

        // ตรวจสอบว่า Number_of_room มากกว่า NRoom หรือไม่
        if (Number_of_room > NRoom) {
            return res.status(400).send(`Requested number of rooms exceeds available rooms. Available rooms: ${NRoom}`);
        }

        // Query เพิ่มข้อมูลใน HotelDeals
        await sql.query`
            INSERT INTO HotelDeals (ID_room, Number_of_room, S_datetimeHD, E_datetimeHD, StatusHD, Total)
            VALUES (${ID_room}, ${Number_of_room}, ${S_datetimeHD}, ${E_datetimeHD}, ${StatusHD}, ${Total})
        `;

        // อัพเดท NRoom โดยลบจำนวนห้องที่จองออกจาก NRoom
        const newNRoom = NRoom - Number_of_room;
        await sql.query`
            UPDATE RoomHotel
            SET NRoom = ${newNRoom}
            WHERE ID_room = ${ID_room}
        `;

        res.send('Insert and update successful');
    } catch (err) {
        console.error('Error inserting or updating the database:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับดึงข้อมูลจาก Hotels และ  HotelDeals โดยเช็คจาก ID_hotel
app.get('/hoteldeals-not-approved/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
      // Query ข้อมูลจาก Hotels และ HotelDeals
    const result = await sql.query`
        SELECT		MIN(RoomlPicture.Img_Url_room) AS MinImg_Url_Hotel,
                    NameH, RoomHotel.ID_room, NameTR, NameTV, NameRS, Number_of_room, 
                    S_datetimeHD, E_datetimeHD, NameOS, HDID, Total, 
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(S_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(S_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datetimeHD) + 543 AS NVARCHAR) AS S_datetimeHD_TH, 
            
                    CASE 
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(E_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(E_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(E_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(E_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(E_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(E_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(E_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(E_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(E_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(E_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(E_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(E_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(E_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(E_datetimeHD) + 543 AS NVARCHAR) AS E_datetimeHD_TH
        FROM		Hotels 
        JOIN		RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
        JOIN		RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
        JOIN		TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
        JOIN		TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room 
        JOIN		RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
        JOIN		HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
        JOIN		OfferStatus		ON HotelDeals.StatusHD		= OfferStatus.ID_Offer_Status
        WHERE		Hotels.ID_hotel = ${ID_hotel}
        AND			OfferStatus.ID_Offer_Status = 1
        GROUP BY	NameH, RoomHotel.ID_room, NameTR, NameTV, NameRS, Number_of_room, S_datetimeHD, E_datetimeHD, NameOS, HDID, Total

    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

app.get('/hoteldeals-not-approved-c/:HDID', async (req, res) => {
    const HDID = req.params.HDID;
    try {
      // Query ข้อมูลจาก Hotels และ HotelDeals
    const result = await sql.query`
        SELECT		MIN(RoomlPicture.Img_Url_room) AS MinImg_Url_Hotel,
			        NameH, RoomHotel.ID_room,NameTR,NameTV,NameRS,Number_of_room,S_datetimeHD, E_datetimeHD, NameOS, HDID
        FROM		Hotels 
        JOIN		RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
        JOIN		RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
        JOIN		TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
        JOIN		TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room 
        JOIN		RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
        JOIN		HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
        JOIN		OfferStatus		ON HotelDeals.StatusHD		= OfferStatus.ID_Offer_Status
        WHERE		HotelDeals.HDID = ${HDID}
        AND			OfferStatus.ID_Offer_Status = 1
        GROUP BY	NameH, RoomHotel.ID_room,NameTR,NameTV,NameRS,Number_of_room,S_datetimeHD, E_datetimeHD, NameOS, HDID
    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับดึงข้อมูลจาก Hotels และ  HotelDeals โดยเช็คจาก ID_hotel
app.get('/hoteldeals-approve/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
      // Query ข้อมูลจาก Hotels และ HotelDeals
    const result = await sql.query`
        SELECT		MIN(RoomlPicture.Img_Url_room) AS MinImg_Url_Hotel,
			NameH, RoomHotel.ID_room,NameTR,NameTV,NameRS,Number_of_room,S_datetimeHD, E_datetimeHD, NameOS, HDID
        FROM		Hotels 
        JOIN		RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
        JOIN		RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
        JOIN		TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
        JOIN		TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room 
        JOIN		RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
        JOIN		HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
        JOIN		OfferStatus		ON HotelDeals.StatusHD		= OfferStatus.ID_Offer_Status
        WHERE		RoomHotel.ID_hotel = ${ID_hotel}
        AND			OfferStatus.ID_Offer_Status = 2
        GROUP BY	NameH, RoomHotel.ID_room,NameTR,NameTV,NameRS,Number_of_room,S_datetimeHD, E_datetimeHD, NameOS, HDID
    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับอัพเดทข้อมูลใน HotelDeals โดยเช็คจาก HDID
app.put('/hoteldeals-hdid/:HDID', async (req, res) => {
    const HDID = req.params.HDID;
    const { Number_of_room, S_datetimeHD, E_datetimeHD, quantity , Total} = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!Number_of_room || !S_datetimeHD || !E_datetimeHD || quantity === undefined || Total === undefined) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Select ID_room จาก HotelDeals โดยใช้ HDID
        const hotelDealResult = await sql.query`
            SELECT ID_room FROM HotelDeals WHERE HDID = ${HDID}
        `;
        const ID_room = hotelDealResult.recordset[0]?.ID_room;

        if (!ID_room) {
            return res.status(404).send('ID_room not found');
        }

        // Select NRoom จาก RoomHotel โดยใช้ ID_room
        const roomHotelResult = await sql.query`
            SELECT NRoom FROM RoomHotel WHERE ID_room = ${ID_room}
        `;
        const NRoom = roomHotelResult.recordset[0]?.NRoom;

        if (NRoom === undefined) {
            return res.status(404).send('NRoom not found');
        }

        let updatedNumber_of_room;
        let updatedNRoom;

        if (quantity < 0) {
            // กรณี quantity เป็นค่าติดลบ
            if (Number_of_room + quantity < 0) {
                return res.status(400).send('Quantity is too low');
            }
            
            // คำนวณค่ารวม
            const newNumber_of_room = Number_of_room + quantity;
            const newNRoom = NRoom + newNumber_of_room;

            // Update RoomHotel
            await sql.query`
                UPDATE RoomHotel 
                SET NRoom = ${newNRoom}
                WHERE ID_room = ${ID_room}
            `;

            // Update HotelDeals
            updatedNumber_of_room = newNumber_of_room;
        } else {
            // กรณี quantity เป็นค่าบวก
            if (quantity > NRoom) {
                return res.status(400).send('Quantity exceeds available rooms');
            }

            // คำนวณค่ารวม
            const newNRoom = NRoom - quantity;
            const newNumber_of_room = Number_of_room + quantity;

            // Update RoomHotel
            await sql.query`
                UPDATE RoomHotel 
                SET NRoom = ${newNRoom}
                WHERE ID_room = ${ID_room}
            `;

            // Update HotelDeals
            updatedNumber_of_room = newNumber_of_room;
        }

        // Update HotelDeals
        await sql.query`
            UPDATE HotelDeals
            SET Number_of_room = ${updatedNumber_of_room},
                S_datetimeHD = ${S_datetimeHD}, 
                E_datetimeHD = ${E_datetimeHD},
                Total = ${Total}
            WHERE HDID = ${HDID}
        `;

        res.send('Update successful');
    } catch (err) {
        console.error('Error updating the database:', err);
        res.status(500).send('Internal server error');
    }
});



// Endpoint สำหรับลบข้อมูลใน HotelDeals โดยเช็คจาก HDID
app.delete('/hoteldeals/:HDID', async (req, res) => {
    const HDID = req.params.HDID;
    try {
      // Query ลบข้อมูลจาก HotelDeals
    await sql.query`
        DELETE FROM HotelDeals
        WHERE HDID = ${HDID}
    `;
    res.send('Delete successful');
    } catch (err) {
    console.error('Error deleting from the database:', err);
    res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับลบข้อมูลใน ConcertDeals โดยเช็คจาก CDID
app.delete('/concertceals/:CDID', async (req, res) => {
    const CDID = req.params.CDID;
    try {
      // Query ลบข้อมูลจาก ConcertDeals
    await sql.query`
        DELETE FROM ConcertDeals
        WHERE CDID = ${CDID}
    `;
    res.send('Delete successful');
    } catch (err) {
    console.error('Error deleting from the database:', err);
    res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับแสดงข้อมูลทั้งหมดจากตาราง TypeTicket
app.get('/typeTickets', async (req, res) => {
    try {
      const result = await sql.query`SELECT * FROM TypeTicket`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับแสดงข้อมูลทั้งหมดจากตาราง TypeHotel
app.get('/typehotel', async (req, res) => {
    try {
      const result = await sql.query`SELECT * FROM TypeHotel`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับแสดงข้อมูลทั้งหมดจากตาราง TypeRoom
app.get('/typeroom', async (req, res) => {
    try {
      const result = await sql.query`SELECT ID_Type_Room, NameTR FROM TypeRoom`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับแสดงข้อมูลทั้งหมดจากตาราง TypeView
app.get('/typeview', async (req, res) => {
    try {
      const result = await sql.query`SELECT * FROM TypeView`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับแสดงข้อมูลทั้งหมดจากตาราง RoomStatus
app.get('/roomstatus', async (req, res) => {
    try {
      const result = await sql.query`SELECT * FROM RoomStatus`;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});


app.get('/typeroom-ed', async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM TypeRoom`;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

app.get('/typehotel-ed', async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM TypeHotel`;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

// Endpoint for TypeHotel
app.get('/typehotel-h', async (req, res) => {
    const { Type_hotel } = req.query;

    if (!Type_hotel) {
        return res.status(400).send('Type_hotel parameter is required');
    }

    try {
        const result = await sql.query`SELECT * FROM TypeHotel WHERE ID_Type_Hotel = ${Type_hotel}`;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

// Endpoint for TypeRoom
app.get('/typeroom-h', async (req, res) => {
    const { Type_room } = req.query;

    if (!Type_room) {
        return res.status(400).send('Type_room parameter is required');
    }

    try {
        const result = await sql.query`SELECT * FROM TypeRoom WHERE ID_Type_Room = ${Type_room}`;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

// Endpoint for TypeView
app.get('/typeview-h', async (req, res) => {
    const { Type_view } = req.query;

    if (!Type_view) {
        return res.status(400).send('Type_view parameter is required');
    }

    try {
        const result = await sql.query`SELECT * FROM TypeView WHERE ID_Type_Room = ${Type_view}`;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});


app.delete('/deletehotel', async (req, res) => {
    const { ID_user, ID_hotel } = req.body;

    if (!ID_user || !ID_hotel) {
        return res.status(400).send('Invalid request, missing ID_user or ID_hotel');
    }

    let transaction;

    try {
        // เริ่มต้นการทำธุรกรรม
        transaction = new sql.Transaction();
        await transaction.begin();

        const request = new sql.Request(transaction);

        // ตรวจสอบว่ามีแพ็กเกจหรือดีลที่เชื่อมโยงกับโรงแรมหรือไม่
        const packageResult = await request.query(`
            SELECT      Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster,
                        Packeage.ID_deals, Hotels.ID_hotel, Concerts.CID
            FROM        Packeage
            JOIN        Deals           ON Packeage.ID_deals    = Deals.ID_deals
            JOIN        HotelDeals      ON Deals.HDID           = HotelDeals.HDID
            JOIN        RoomHotel       ON HotelDeals.ID_room   = RoomHotel.ID_room
            JOIN		HotelSendDeals	ON HotelDeals.HDID		= HotelSendDeals.HDID
            JOIN        Hotels          ON RoomHotel.ID_hotel   = Hotels.ID_hotel
            JOIN        ConcertDeals    ON Deals.CDID           = ConcertDeals.CDID
            JOIN        Concerts        ON ConcertDeals.CID     = Concerts.CID
            JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
            WHERE       Hotels.ID_hotel = ${ID_hotel}
            AND         Deals.StatusD   = 2
            GROUP BY    Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                        Packeage.ID_deals, Hotels.ID_hotel, Concerts.CID
        `);

        // ถ้ามีแพ็กเกจที่ยังคงมีสถานะใช้งานอยู่ ให้ส่งข้อความเตือนและไม่ทำการลบ
        if (packageResult.recordset.length > 0) {
            await transaction.rollback();
            return res.status(400).send('Cannot delete hotel because there are active packages or deals associated with it.');
        }

        // เลือก ID_room ตาม ID_hotel
        const roomResult = await request.query(`SELECT ID_room FROM RoomHotel WHERE ID_hotel = ${ID_hotel}`);
        const ID_rooms = roomResult.recordset.map(record => record.ID_room);

        // เลือก HDID ที่เชื่อมโยงกับแต่ละห้อง (ใช้ ID_room ใน WHERE)
        for (let ID_room of ID_rooms) {
            const hdidResult = await request.query(`SELECT HDID FROM HotelDeals WHERE ID_room = ${ID_room}`);
            const HDIDS = hdidResult.recordset.map(record => record.HDID);

            // ลบข้อมูลจาก HotelSendDeals โดยใช้ HDID
            if (HDIDS.length > 0) {
                await request.query(`DELETE FROM HotelSendDeals WHERE HDID IN (${HDIDS.join(',')})`);
            }

            // ลบภาพของห้องและข้อมูลห้องจาก HotelDeals
            await request.query(`DELETE FROM RoomlPicture WHERE ID_room = ${ID_room}`);
            await request.query(`DELETE FROM HotelDeals WHERE ID_room = ${ID_room}`);
        }

        // ลบข้อมูลที่เกี่ยวข้องกับโรงแรม
        await request.query(`DELETE FROM HotelPicture WHERE ID_hotel = ${ID_hotel}`);
        await request.query(`DELETE FROM RoomHotel WHERE ID_hotel = ${ID_hotel}`);
        await request.query(`DELETE FROM ChanelHotel WHERE ID_hotel = ${ID_hotel}`);

        // ลบข้อมูลโรงแรม
        await request.query(`DELETE FROM Hotels WHERE ID_user = ${ID_user} AND ID_hotel = ${ID_hotel}`);

        // คอมมิตธุรกรรมหากไม่มีข้อผิดพลาด
        await transaction.commit();

        res.send('Records deleted successfully');
    } catch (err) {
        console.error('Error deleting records:', err);
        if (transaction) {
            await transaction.rollback();
        }
        res.status(500).send('Internal server error');
    }
});



// Endpoint สำหรับแสดงข้อมูลจากตาราง RoomStatus โดยเช็คจาก Status_room
app.get('/roomStatus/:Status_room', async (req, res) => {
    const { Status_room } = req.params;

    try {
      // Query ข้อมูลจาก RoomStatus โดยเช็คจาก Status_room
        const result = await sql.query`
        SELECT * FROM RoomStatus WHERE ID_Room_Status = ${Status_room}
        `;

      // เช็คผลลัพธ์และส่งกลับ
        if (result.recordset.length === 0) {
        return res.status(404).send('No records found for the given Status_room');
        }

        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

// Endpoint for TypeView
app.get('/typeview-ed', async (req, res) => {
    const { Type_view } = req.query;

    try {
        let result;
        if (Type_view) {
            result = await sql.query`SELECT * FROM TypeView WHERE ID_Type_Room = ${Type_view}`;
        } else {
            result = await sql.query`SELECT * FROM TypeView`; // ดึงข้อมูลทั้งหมดถ้าไม่มีพารามิเตอร์
        }
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint for RoomStatus
app.get('/roomstatus-ed', async (req, res) => {
    const { Status_room } = req.query;

    try {
        let result;
        if (Status_room) {
            result = await sql.query`SELECT * FROM RoomStatus WHERE ID_Room_Status = ${Status_room}`;
        } else {
            result = await sql.query`SELECT * FROM RoomStatus`; // ดึงข้อมูลทั้งหมดถ้าไม่มีพารามิเตอร์
        }
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับแสดงข้อมูลจากตาราง TypeTicket โดยเช็คกับ TID
app.get('/typeTickets/:tid', async (req, res) => {
    const { tid } = req.params;
    try {
        const result = await sql.query`SELECT * FROM TypeTicket WHERE TID = ${tid}`;
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]); // ส่งกลับ object เดียว
        } else {
            res.status(404).send('No records found');
        }
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

// Endpoint สำหรับแสดงข้อมูล OfferStatus โดยเช็ค StatusHD กับ ID_Offer_Status
app.get('/offerStatus/:statusHD', async (req, res) => {
    const { statusHD } = req.params;

    try {
    const result = await sql.query`
        SELECT  * 
        FROM    OfferStatus
        WHERE   ID_Offer_Status = ${statusHD}
    `;

    if (result.recordset.length === 0) {
        res.status(404).send('No offer status found for the given StatusHD');
        return;
    }

    res.json(result.recordset);
    } catch (err) {
    console.error('Error fetching offer status:', err);
    res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับแสดงข้อมูล HotelDeals ทั้งหมดโดยเช็ค StatusHD
app.get('/hoteldeals-status/:statusHD', async (req, res) => {
    const { statusHD } = req.params;

    try {
    const result = await sql.query`
        SELECT  * 
        FROM    HotelDeals,Hotels,TypeHotel
        WHERE   StatusHD            = ${statusHD}
        AND	    HotelDeals.ID_hotel = Hotels.ID_hotel
        AND     Hotels.Type_room    = TypeHotel.ID_Type_Hotel

    `;

    if (result.recordset.length === 0) {
        res.status(404).send('No hotel deals found for the given StatusHD');
        return;
    }

    res.json(result.recordset);
    } catch (err) {
    console.error('Error fetching hotel deals:', err);
    res.status(500).send('Internal server error');
    }
});



// Endpoint สำหรับแสดงข้อมูล HotelDeals ทั้งหมดโดยเช็ค StatusHD
app.get('/concertsdeals-status/:statusCD', async (req, res) => {
    const { statusCD } = req.params;

    try {
    const result = await sql.query`
        SELECT  * 
        FROM    ConcertDeals,Concerts
        WHERE   StatusCD            = ${statusCD}
        AND	    ConcertDeals.CID    = Concerts.CID

    `;

    if (result.recordset.length === 0) {
        res.status(404).send('No hotel deals found for the given StatusHD');
        return;
    }

    res.json(result.recordset);
    } catch (err) {
    console.error('Error fetching hotel deals:', err);
    res.status(500).send('Internal server error');
    }
});



app.get('/detailconcertsmt/:cid', (req, res) => {
    const { cid } = req.params;
    console.log('Received CID:', cid); // Log the received CID

    if (!cid) {
        return res.status(400).send('CID is required.');
    }
    
    // Convert cid to an integer if it's a string
    const cidInt = parseInt(cid, 10);
    if (isNaN(cidInt)) {
        return res.status(400).send('CID must be a valid integer.');
    }

    const query = `SELECT      Concerts.CID, Show_secheduld, Poster, Name, NameTC, NameTS, Ticket_zone, Price, Address, Detail, LineUP,Time,
                                CASE 
                                    WHEN DATENAME(WEEKDAY, StartDate) = 'Monday'    THEN 'วันจันทร์'
                                    WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday'   THEN 'วันอังคาร'
                                    WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                                    WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday'  THEN 'วันพฤหัสบดี'
                                    WHEN DATENAME(WEEKDAY, StartDate) = 'Friday'    THEN 'วันศุกร์'
                                    WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday'  THEN 'วันเสาร์'
                                    WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday'    THEN 'วันอาทิตย์'
                                END + ' ' +
                                FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                                CASE 
                                    WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                                    WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                                    WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                                    WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                                    WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                                    WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                                    WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                                    WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                                    WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                                    WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                                    WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                                    WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                                END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                                CASE 
                                    WHEN DATENAME(WEEKDAY, EndDate) = 'Monday'      THEN 'วันจันทร์'
                                    WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday'     THEN 'วันอังคาร'
                                    WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday'   THEN 'วันพุธ'
                                    WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday'    THEN 'วันพฤหัสบดี'
                                    WHEN DATENAME(WEEKDAY, EndDate) = 'Friday'      THEN 'วันศุกร์'
                                    WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday'    THEN 'วันเสาร์'
                                    WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday'      THEN 'วันอาทิตย์'
                                END + ' ' +
                                FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                                CASE 
                                    WHEN MONTH(EndDate) = 1  THEN 'มกราคม' 
                                    WHEN MONTH(EndDate) = 2  THEN 'กุมภาพันธ์' 
                                    WHEN MONTH(EndDate) = 3  THEN 'มีนาคม' 
                                    WHEN MONTH(EndDate) = 4  THEN 'เมษายน' 
                                    WHEN MONTH(EndDate) = 5  THEN 'พฤษภาคม' 
                                    WHEN MONTH(EndDate) = 6  THEN 'มิถุนายน' 
                                    WHEN MONTH(EndDate) = 7  THEN 'กรกฎาคม' 
                                    WHEN MONTH(EndDate) = 8  THEN 'สิงหาคม' 
                                    WHEN MONTH(EndDate) = 9  THEN 'กันยายน' 
                                    WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                                    WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                                    WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                                END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
                    FROM        Concerts
                    JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
                    JOIN        TicketInform    ON ShowTime.CID         = TicketInform.CID
                    JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_con
                    JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
                    WHERE       Concerts.CID    = @CID
                    ORDER BY    Concerts.CID    DESC`;
    const inputs = [
        { name: 'CID', type: sql.Int, value: cidInt } // use cidInt
    ];

    executeQuery(query, inputs, (err, result) => {
        if (err) {
            console.error('Get concerts query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(404).send('Concerts not found for this CID.');
        }

        res.json(result.recordset);
    });
});


// Endpoint สำหรับเพิ่มข้อมูลใน Deals
app.post('/add-deals', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD } = req.body;

    if (!HDID || !CDID || !Datetime_match || !StatusD) {
    return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, and StatusD');
    }

    try {
    const result = await sql.query`
        INSERT INTO Deals (HDID, CDID, Datetime_match, StatusD)
        VALUES (${HDID}, ${CDID}, ${Datetime_match}, ${StatusD})
    `;

    res.status(201).send('Deal added successfully');
    } catch (err) {
    console.error('Error adding deal:', err);
    res.status(500).send('Internal server error');
    }
});




app.get('/hoteldeals-notyou-status/:statusHD/:ID_user', async (req, res) => {
    const { statusHD, ID_user } = req.params;
    const { search, Number_of_room, PriceH, S_datetimeHD, E_datetimeHD } = req.query;

    try {
        let query = `
            SELECT      MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                        Hotels.ID_hotel, HDID, Number_of_room, PriceH, NameTH, NameTR, NameTV, AddressH, S_datetimeHD, E_datetimeHD, NameH, NameOS, Total,
                        CASE 
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(S_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(S_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datetimeHD) + 543 AS NVARCHAR) AS S_datetimeHD_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(E_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(E_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(E_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(E_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(E_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(E_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(E_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(E_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(E_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(E_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(E_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(E_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(E_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(E_datetimeHD) + 543 AS NVARCHAR) AS E_datetimeHD_TH

            FROM        HotelDeals 
            JOIN        RoomHotel       ON HotelDeals.ID_room   = RoomHotel.ID_room
            JOIN        RoomlPicture    ON RoomHotel.ID_room    = RoomlPicture.ID_room
            JOIN        OfferStatus     ON HotelDeals.StatusHD  = OfferStatus.ID_Offer_Status
            JOIN        TypeView        ON RoomHotel.Type_view  = TypeView.ID_Type_Room
            JOIN        TypeRoom        ON RoomHotel.Type_room  = TypeRoom.ID_Type_Room
            JOIN        Hotels          ON RoomHotel.ID_hotel   = Hotels.ID_hotel
            JOIN        TypeHotel       ON Hotels.Type_hotel    = TypeHotel.ID_Type_Hotel
            WHERE       HotelDeals.StatusHD = ${statusHD}
            AND         Hotels.ID_user != ${ID_user}
        `;

        // Add search filter if the search query is provided
        if (search) {
            query += `
                AND (
                    NameH     LIKE '%${search}%' OR
                    NameTH    LIKE '%${search}%' OR
                    NameTR    LIKE '%${search}%' OR
                    NameTV    LIKE '%${search}%' OR
                    AddressH  LIKE '%${search}%' OR
                    PriceH    LIKE '%${search}%' OR
                    Total     LIKE '%${search}%' OR
                    NameOS    LIKE '%${search}%' OR
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(S_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(S_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datetimeHD) + 543 AS NVARCHAR) LIKE '%${search}%' OR

                    CASE 
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(E_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(E_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(E_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(E_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(E_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(E_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(E_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(E_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(E_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(E_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(E_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(E_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(E_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(E_datetimeHD) + 543 AS NVARCHAR) LIKE '%${search}%' 
                )
            `;
        }

        // Additional filters
        if (Number_of_room) {
            query += ` AND Number_of_room = ${Number_of_room}`;
        }
        if (PriceH) {
            query += ` AND PriceH <= ${PriceH}`;
        }
        if (S_datetimeHD) {
            query += ` AND S_datetimeHD >= ${S_datetimeHD}`;
        }
        if (E_datetimeHD) {
            query += ` AND E_datetimeHD <= ${E_datetimeHD}`;
        }

        query += `
            GROUP BY    Hotels.ID_hotel, HDID, Number_of_room, PriceH, NameTH, NameTR, NameTV, AddressH, S_datetimeHD, E_datetimeHD, NameH, NameOS, Total
        `;

        const result = await sql.query(query);

        if (result.recordset.length === 0) {
            res.status(404).send('No hotel deals found for the given criteria');
            return;
        }

        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching hotel deals:', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/add-deals-update-hdid-other', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD, NumOfRoom, Number_of_room } = req.body;

    // Check if all required fields are provided
    if (!HDID || !CDID || !Datetime_match || !StatusD || !NumOfRoom || !Number_of_room) {
        return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, Number_of_room, NumOfRoom and StatusD');
    }
    // Check if NumOfRoom is equal to Number_of_room
    if (NumOfRoom !== Number_of_room) {
        return res.status(400).send(`NumOfRoom must equal the available Number_of_room (${Number_of_room}). Please correct the input.`);
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        // Use a new request object for the second query
        const request2 = new sql.Request(transaction);
        
        // Get the current Number_of_room from the HotelDeals table
        const result = await request2.query`
            SELECT Number_of_room
            FROM HotelDeals
            WHERE HDID = ${HDID}
        `;

        if (result.recordset.length === 0) {
            throw new Error('Hotel deal not found');
        }

        const currentNumberOfRoom = result.recordset[0].Number_of_room;

        // Check if the requested NumOfRoom is more than the available rooms
        if (NumOfRoom > currentNumberOfRoom) {
            await transaction.rollback();
            return res.status(400).send('NumOfRoom exceeds available Number_of_room');
        }

        // Insert into Deals table
        const request1 = new sql.Request(transaction);
        await request1.query`
            INSERT INTO Deals (HDID, CDID, Datetime_match, StatusD)
            VALUES (${HDID}, ${CDID}, ${Datetime_match}, ${StatusD})
        `;

        // Calculate the new Number_of_room
        const updatedNumberOfRoom = currentNumberOfRoom - NumOfRoom;

        // Update the Number_of_room in the HotelDeals table
        const request3 = new sql.Request(transaction);
        await request3.query`
            UPDATE HotelDeals
            SET Number_of_room = ${updatedNumberOfRoom}
            WHERE HDID = ${HDID}
        `;

        // Insert into HotelSendDeals table
        const request4 = new sql.Request(transaction);
        await request4.query`
            INSERT INTO HotelSendDeals (HDID, StatusHD, NumOfRooms)
            VALUES (${HDID}, 2, ${NumOfRoom})
        `;

        await transaction.commit();
        res.status(201).send('Deal added and HotelDeals status and room number updated successfully');
    } catch (err) {
        await transaction.rollback();
        console.error('Error adding deal and updating HotelDeals:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/add-deals-update-hdid', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD, NumOfRoom } = req.body;
    console.log('Received data:', req.body); // แสดงข้อมูลที่ได้รับจาก Client

    // ตรวจสอบว่าได้รับข้อมูลครบถ้วนหรือไม่
    if (!HDID || !CDID || !Datetime_match || !StatusD || !NumOfRoom) {
        return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, NumOfRoom and StatusD');
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        // ใช้ request ใหม่สำหรับการ Query ข้อมูล
        const request2 = new sql.Request(transaction);

        // ดึงค่า Number_of_room ปัจจุบันจากตาราง HotelDeals
        const result = await request2.query`
            SELECT Number_of_room
            FROM HotelDeals
            WHERE HDID = ${HDID}
        `;

        if (result.recordset.length === 0) {
            throw new Error('Hotel deal not found');
        }

        const currentNumberOfRoom = result.recordset[0].Number_of_room;

        // ตรวจสอบว่า NumOfRoom ตรงกับ Number_of_room หรือไม่
        if (NumOfRoom !== currentNumberOfRoom) {
            await transaction.rollback();
            return res.status(400).send('NumOfRoom does not match the available Number_of_room. Please enter the correct number.');
        }

        // Insert ลงในตาราง Deals
        const request1 = new sql.Request(transaction);
        await request1.query`
            INSERT INTO Deals (HDID, CDID, Datetime_match, StatusD)
            VALUES (${HDID}, ${CDID}, ${Datetime_match}, ${StatusD})
        `;

        // คำนวณค่า Number_of_room ใหม่
        const updatedNumberOfRoom = currentNumberOfRoom - NumOfRoom;

        // อัปเดตจำนวนห้องในตาราง HotelDeals
        const request3 = new sql.Request(transaction);
        await request3.query`
            UPDATE HotelDeals
            SET Number_of_room = ${updatedNumberOfRoom}
            WHERE HDID = ${HDID}


            UPDATE HotelDeals
            SET StatusHD = 2
            WHERE HDID = ${HDID}
        `;

        // Insert ลงในตาราง HotelSendDeals
        const request4 = new sql.Request(transaction);
        await request4.query`
            INSERT INTO HotelSendDeals (HDID, StatusHD, NumOfRooms)
            VALUES (${HDID}, 2, ${NumOfRoom})
        `;

        // Commit ธุรกรรม
        await transaction.commit();
        res.status(201).send('Deal added and HotelDeals status and room number updated successfully');
    } catch (err) {
        // Rollback ธุรกรรมเมื่อเกิดข้อผิดพลาด
        await transaction.rollback();
        console.error('Error adding deal and updating HotelDeals:', err);
        res.status(500).send('Internal server error');
    }
});



app.post('/add-deals-update-cdid', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD, Con_NumOfRooms, Number_of_room } = req.body;

    // ตรวจสอบว่าได้ส่งข้อมูลที่จำเป็นครบหรือไม่
    if (!HDID || !CDID || !Datetime_match || !StatusD || !Con_NumOfRooms || !Number_of_room) {
        return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, StatusD, Con_NumOfRooms, and Number_of_room');
    }

    // ตรวจสอบว่า Con_NumOfRooms ไม่เกิน Number_of_room
    if (Con_NumOfRooms > Number_of_room) {
        return res.status(400).send('Con_NumOfRooms cannot be greater than Number_of_room');
    }

    // ตรวจสอบว่า Con_NumOfRooms และ Number_of_room เท่ากันหรือไม่
    if (Con_NumOfRooms !== Number_of_room) {
        return res.status(400).send('Con_NumOfRooms and Number_of_room must be equal. Please enter correct values.');
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();
        const request1 = new sql.Request(transaction);

        // Insert into Deals table
        await request1.query(`
            INSERT INTO Deals (HDID, CDID, Datetime_match, StatusD)
            VALUES (${HDID}, ${CDID}, '${Datetime_match}', ${StatusD})
        `);

        const request2 = new sql.Request(transaction);

        // Update ConcertDeals table
        await request2.query(`
            UPDATE ConcertDeals
            SET StatusCD = 2
            WHERE CDID = ${CDID}
        `);

        const request3 = new sql.Request(transaction);

        // Insert into ConcertSendDeals table
        await request3.query(`
            INSERT INTO ConcertSendDeals (CDID, Con_NumOfRooms, StatusCD)
            VALUES (${CDID}, ${Con_NumOfRooms}, 2)
        `);

        await transaction.commit();
        res.status(201).send('Deal added and ConcertDeals status updated successfully');
    } catch (err) {
        await transaction.rollback();
        console.error('Error adding deal and updating ConcertDeals status:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับการกดปุ่ม Yes
app.post('/confirm-concert-offer', async (req, res) => {
    console.log(req.body); 
    const { CDID, ID_deals, Deadline_package, S_Deadline_package, HDID, Number_of_room, Con_NumOfRooms } = req.body;

    if (!CDID || !ID_deals || !Deadline_package || !S_Deadline_package || !HDID || !Number_of_room || !Con_NumOfRooms) {
        return res.status(400).send('Please provide all required fields: CDID, ID_deals, Deadline_package, S_Deadline_package, HDID, Number_of_room, and Con_NumOfRooms');
    }

    try {
        // Initialize the connection and transaction
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {

            const concertDetails = await pool.request()
            .input('CDID', sql.Int, CDID)
            .query(`
                SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                FROM		Concerts 
                JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                WHERE		ConcertDeals.CDID = @CDID
            `);

            const hotelDetails = await pool.request()
                .input('HDID', sql.Int, HDID)
                .query(`
                    SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                    (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                    (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD, NumOfRooms
                    FROM			HotelPicture
                    JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                    JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                    JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                    JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                    JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                    JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                    LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                    WHERE			HotelDeals.HDID = @HDID
                    GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
            `);
            
            const CurrentTime = await pool.request().query(`SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') AS DateAction`)
            
                // Insert data into UserHistory
                await pool.request()
                    .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
                    .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
                    .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
                    .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
                    .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
                    .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
                    .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
                    .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
                    .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
                    .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
                    .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
                    .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
                    .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
                    .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
                    .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
                    .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
                    .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
                    .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
                    .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
                    .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
                    .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
                    .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
                    .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
                    .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
                    .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
                    .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
                    .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
                    .input('NumOfRooms',        sql.Int,     hotelDetails.recordset[0].NumOfRooms)
                    .input('DateAction',        sql.Date,    CurrentTime.recordset[0].DateAction)
                    .query(`
                        INSERT INTO UserHistory (
                            ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                            ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                            E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
                        )
                        VALUES (
                            @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                            @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 5, @ID_user_Hotel,
                            @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                            @NumOfRooms, 6, @DateAction
                        );
                    `);

            // Insert into Package table
            const packageRequest = new sql.PreparedStatement(transaction);
            packageRequest.input('ID_deals', sql.Int);
            packageRequest.input('Deadline_package', sql.Date);
            packageRequest.input('S_Deadline_package', sql.Date);

            await packageRequest.prepare(`
                INSERT INTO Packeage (ID_deals, Deadline_package, S_Deadline_package)
                VALUES (@ID_deals, @Deadline_package, @S_Deadline_package)
            `);
            await packageRequest.execute({
                ID_deals: ID_deals,
                Deadline_package: new Date(Deadline_package),
                S_Deadline_package: new Date(S_Deadline_package)
            });
            await packageRequest.unprepare();

            // Update ConcertDeals
            const concertDealsRequest = new sql.PreparedStatement(transaction);
            concertDealsRequest.input('CDID', sql.Int);

            await concertDealsRequest.prepare(`
                UPDATE ConcertDeals
                SET StatusCD = 2
                WHERE CDID = @CDID
            `);
            const updateConcertDealsResult = await concertDealsRequest.execute({ CDID: CDID });
            await concertDealsRequest.unprepare();

            if (updateConcertDealsResult.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(404).send('Concert deal not found');
            }

            // Update Deals
            const dealsRequest = new sql.PreparedStatement(transaction);
            dealsRequest.input('ID_deals', sql.Int);

            await dealsRequest.prepare(`
                UPDATE Deals
                SET StatusD = 2
                WHERE ID_deals = @ID_deals
            `);
            const updateDealsResult = await dealsRequest.execute({ ID_deals: ID_deals });
            await dealsRequest.unprepare();

            if (updateDealsResult.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(404).send('Deal not found');
            }

            // Update HotelDeals: Number_of_room = Number_of_room - Con_NumOfRooms
            const hotelDealsRequest = new sql.PreparedStatement(transaction);
            hotelDealsRequest.input('HDID', sql.Int);
            hotelDealsRequest.input('Con_NumOfRooms', sql.Int);

            await hotelDealsRequest.prepare(`
                UPDATE HotelDeals
                SET Number_of_room = Number_of_room - @Con_NumOfRooms
                WHERE HDID = @HDID


                UPDATE HotelDeals
                SET StatusHD = 2
                WHERE HDID = @HDID


                UPDATE HotelSendDeals
                SET StatusHD = 2
                WHERE HDID = @HDID
            `);
            const updateHotelDealsResult = await hotelDealsRequest.execute({
                HDID: HDID,
                Con_NumOfRooms: Con_NumOfRooms
            });
            await hotelDealsRequest.unprepare();

            if (updateHotelDealsResult.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(404).send('Hotel deal not found');
            }

            // Commit transaction
            await transaction.commit();
            res.status(200).send('Concert offer confirmed, package created, hotel deal, and concert deal updated successfully');
        } catch (err) {
            // Rollback transaction on error
            await transaction.rollback();
            console.error('Transaction error:', err);
            res.status(500).send('Transaction error');
        }
    } catch (err) {
        console.error('Error confirming concert offer:', err);
        res.status(500).send('Internal server error');
    }
});



// Endpoint สำหรับการกดปุ่ม Yes
app.post('/confirm-concert-offer', async (req, res) => {
    console.log(req.body); 
    const { CDID, ID_deals, Deadline_package, S_Deadline_package, HDID, Number_of_room, Con_NumOfRooms } = req.body;

    // Validate required fields
    if (!CDID || !ID_deals || !Deadline_package || !S_Deadline_package || !HDID || !Number_of_room || !Con_NumOfRooms) {
        return res.status(400).send('Please provide all required fields: CDID, ID_deals, Deadline_package, S_Deadline_package, HDID, Number_of_room, and Con_NumOfRooms');
    }

    // Validate that Number_of_room and Con_NumOfRooms are numeric
    if (isNaN(Number_of_room) || isNaN(Con_NumOfRooms)) {
        return res.status(400).send('Number_of_room and Con_NumOfRooms must be numeric');
    }

    try {
        // Initialize the connection and transaction
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Fetch concert details
            const concertDetails = await pool.request()
                .input('CDID', sql.Int, CDID)
                .query(`
                    SELECT (Concerts.ID_user) AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, 
                           NameTC, NameTS, NameT, Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, 
                           (S_datetime) AS S_datelineCD, (E_datetime) AS E_datelineCD
                    FROM Concerts 
                    JOIN TypeConcert ON Concerts.Con_type = ID_Type_Con
                    JOIN ShowTime ON Concerts.CID = ShowTime.CID
                    JOIN TypeShow ON Concerts.Per_type = ID_Type_Show
                    JOIN TicketInform ON Concerts.CID = TicketInform.CID
                    JOIN TypeTicket ON TicketInform.Type = TypeTicket.TID
                    JOIN ConcertDeals ON Concerts.CID = ConcertDeals.CID
                    LEFT JOIN ConcertSendDeals ON ConcertDeals.CDID = ConcertSendDeals.CDID
                    WHERE ConcertDeals.CDID = @CDID
                `);

            // Fetch hotel details
            const hotelDetails = await pool.request()
                .input('HDID', sql.Int, HDID)
                .query(`
                    SELECT MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel, MIN(RoomPicture.Img_Url_room) AS Img_Url_room,
                           (Hotels.ID_user) AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                           (PriceH) AS PriceH, (S_datetimeHD) AS S_datelineHD, (E_datetimeHD) AS E_datelineHD, NumOfRooms
                    FROM HotelPicture
                    JOIN RoomHotel ON HotelPicture.ID_hotel = RoomHotel.ID_hotel
                    JOIN Hotels ON RoomHotel.ID_hotel = Hotels.ID_hotel
                    JOIN RoomPicture ON RoomHotel.ID_room = RoomPicture.ID_room
                    JOIN TypeRoom ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
                    JOIN TypeView ON RoomHotel.Type_view = TypeView.ID_Type_Room
                    JOIN HotelDeals ON RoomHotel.ID_room = HotelDeals.ID_room
                    LEFT JOIN HotelSendDeals ON HotelDeals.HDID = HotelSendDeals.HDID
                    WHERE HotelDeals.HDID = @HDID
                    GROUP BY ID_user_Hotel, NameH, AddressH, NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
                `);

            // Get current time
            const CurrentTime = await pool.request().query(`
                SELECT CONVERT(VARCHAR, GETDATE(), 120) AS DateAction
            `);

            // Insert data into UserHistory
            await pool.request()
                .input('ID_user_Concert', sql.Int, concertDetails.recordset[0].ID_user_Concert)
                .input('Name', sql.VarChar, concertDetails.recordset[0].Name)
                .input('Show_secheduld', sql.VarChar, concertDetails.recordset[0].Show_secheduld)
                .input('Poster', sql.VarChar, concertDetails.recordset[0].Poster)
                .input('Address', sql.VarChar, concertDetails.recordset[0].Address)
                .input('StartDate', sql.Date, concertDetails.recordset[0].StartDate)
                .input('EndDate', sql.Date, concertDetails.recordset[0].EndDate)
                .input('NameTC', sql.VarChar, concertDetails.recordset[0].NameTC)
                .input('NameTS', sql.VarChar, concertDetails.recordset[0].NameTS)
                .input('NameT', sql.VarChar, concertDetails.recordset[0].NameT)
                .input('Number_of_ticket', sql.Int, concertDetails.recordset[0].Number_of_ticket)
                .input('PriceCD', sql.Int, concertDetails.recordset[0].PriceCD)
                .input('Ticket_zone', sql.VarChar, concertDetails.recordset[0].Ticket_zone)
                .input('Time', sql.VarChar, concertDetails.recordset[0].Time)
                .input('Con_NumOfRooms', sql.Int, concertDetails.recordset[0].Con_NumOfRooms)
                .input('S_datelineCD', sql.Date, concertDetails.recordset[0].S_datelineCD)
                .input('E_datelineCD', sql.Date, concertDetails.recordset[0].E_datelineCD)
                .input('ID_user_Hotel', sql.Int, hotelDetails.recordset[0].ID_user_Hotel)
                .input('Img_Url_Hotel', sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
                .input('Img_Url_room', sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
                .input('NameH', sql.VarChar, hotelDetails.recordset[0].NameH)
                .input('AddressH', sql.VarChar, hotelDetails.recordset[0].AddressH)
                .input('NameTR', sql.VarChar, hotelDetails.recordset[0].NameTR)
                .input('NameTV', sql.VarChar, hotelDetails.recordset[0].NameTV)
                .input('PriceH', sql.Int, hotelDetails.recordset[0].PriceH)
                .input('S_datelineHD', sql.Date, hotelDetails.recordset[0].S_datelineHD)
                .input('E_datelineHD', sql.Date, hotelDetails.recordset[0].E_datelineHD)
                .input('NumOfRooms', sql.Int, hotelDetails.recordset[0].NumOfRooms)
                .input('DateAction', sql.Date, CurrentTime.recordset[0].DateAction)
                .query(`
                    INSERT INTO UserHistory (
                        ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                        Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                        ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriceH, S_datelineHD, 
                        E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
                    )
                    VALUES (
                        @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                        @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 5, @ID_user_Hotel,
                        @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriceH, @S_datelineHD, @E_datelineHD,
                        @NumOfRooms, 6, @DateAction
                    );
                `);

            // Insert into Package table
            const packageRequest = new sql.PreparedStatement(transaction);
            packageRequest.input('ID_deals', sql.Int);
            packageRequest.input('Deadline_package', sql.Date);
            packageRequest.input('S_Deadline_package', sql.Date);

            await packageRequest.prepare(`
                INSERT INTO Package (ID_deals, Deadline_package, S_Deadline_package)
                VALUES (@ID_deals, @Deadline_package, @S_Deadline_package)
            `);
            await packageRequest.execute({
                ID_deals: ID_deals,
                Deadline_package: new Date(Deadline_package),
                S_Deadline_package: new Date(S_Deadline_package)
            });
            await packageRequest.unprepare();

            // Update ConcertDeals
            const concertDealsRequest = new sql.PreparedStatement(transaction);
            concertDealsRequest.input('CDID', sql.Int);
            await concertDealsRequest.prepare(`
                UPDATE ConcertDeals SET Con_status = 4 WHERE CDID = @CDID
            `);
            await concertDealsRequest.execute({ CDID });
            await concertDealsRequest.unprepare();

            // Update HotelDeals
            const hotelDealsRequest = new sql.PreparedStatement(transaction);
            hotelDealsRequest.input('HDID', sql.Int);
            await hotelDealsRequest.prepare(`
                UPDATE HotelDeals SET Hotel_status = 4 WHERE HDID = @HDID
            `);
            await hotelDealsRequest.execute({ HDID });
            await hotelDealsRequest.unprepare();

            // Commit transaction
            await transaction.commit();
            res.status(200).send('Transaction completed successfully.');
        } catch (error) {
            // Rollback transaction if there's an error
            await transaction.rollback();
            res.status(500).send('Transaction failed and rolled back.');
        }

    } catch (error) {
        res.status(500).send('Error connecting to the database');
    }
});


app.post('/cancel-concert-offers', async (req, res) => {
    const { CDID, HDID } = req.body;

    if (!CDID || !HDID) {
        return res.status(400).send('Please provide the CDID and HDID');
    }

    const cdidValue = Array.isArray(CDID) ? CDID[0] : CDID;
    const hdidValue = Array.isArray(HDID) ? HDID[0] : HDID;

    let transaction; // ประกาศตัวแปร transaction ก่อน

    try {
        let pool = await sql.connect(dbConfig);
        transaction = new sql.Transaction(pool); // สร้าง transaction ที่นี่

        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input('CDID', sql.Int, cdidValue);
        request.input('HDID', sql.Int, hdidValue);

        const concertDetails = await request
            .query(`
                SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                FROM		Concerts 
                JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                WHERE		ConcertDeals.CDID = @CDID
            `);

        const hotelDetails = await request
            .query(`
                SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD, NumOfRooms
                FROM			HotelPicture
                JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                WHERE			HotelDeals.HDID = @HDID
                GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
            `);

        if (!concertDetails.recordset.length || !hotelDetails.recordset.length) {
            await transaction.rollback();
            return res.status(404).send('Concert or hotel deal not found');
        }

        const currentTime = await request.query(`SELECT FORMAT(GETDATE(), 'yyyy-MM-dd HH:mm') AS DateAction`); // ประกาศตัวแปร currentTime

        await request
            .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
            .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
            .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
            .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
            .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
            .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
            .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
            .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
            .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
            .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
            .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
            .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
            .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
            .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
            .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
            .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
            .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
            .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
            .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
            .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
            .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
            .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
            .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
            .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
            .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
            .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
            .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
            .input('NumOfRooms',        sql.Int,     hotelDetails.recordset[0].NumOfRooms)
            .input('DateAction',        sql.Date,    currentTime.recordset[0].DateAction)
            .query(`
                INSERT INTO UserHistory (
                    ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                    Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                    ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                    E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
                )
                VALUES (
                    @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                    @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 9, @ID_user_Hotel,
                    @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                    @NumOfRooms, 18, @DateAction
                );
            `);

        const updateResult = await request.query(`
            UPDATE ConcertDeals
            SET StatusCD = 2
            WHERE CDID = @CDID

            DELETE FROM ConcertSendDeals
            WHERE CDID = @CDID
        `);

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Concert offer not found');
        }

        const deleteResult = await request.query(`
            DELETE FROM Deals
            WHERE CDID = @CDID
        `);

        if (deleteResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Deal not found');
        }

        await transaction.commit();
        res.status(200).send('Concert offer cancelled and deal deleted successfully');
    } catch (err) {
        console.error('Error cancelling concert offer and deleting deal:', err.message);
        
        // ตรวจสอบ transaction ว่ามีการสร้างหรือไม่ ก่อน rollback
        if (transaction) {
            await transaction.rollback();
        }

        res.status(500).send('Internal server error');
    }
});




app.post('/cancel-hotel-offers', async (req, res) => {
    console.log('Request Body:', req.body); // ตรวจสอบข้อมูลที่รับจาก Postman
    const { HDID, CDID } = req.body;

    // แก้ข้อความให้ชัดเจนในการตรวจสอบ HDID และ CDID
    if (!HDID || !CDID) {
        return res.status(400).send('Please provide both HDID and CDID');
    }

    const hdidValue = Array.isArray(HDID) ? HDID[0] : HDID;
    const cdidValue = Array.isArray(CDID) ? CDID[0] : CDID;
    if (!hdidValue || !cdidValue) {
        return res.status(400).send('Invalid HDID or CDID');
    }
    
    try {
        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();
        const request = new sql.Request(transaction);

        // Declare the parameters once
        request.input('HDID', sql.VarChar, hdidValue);
        request.input('CDID', sql.VarChar, cdidValue);
        

        // Query concert details
        const concertDetails = await request.query(`
            SELECT (Concerts.ID_user) AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, 
                   NameTC, NameTS, NameT, Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, 
                   (S_datetime) AS S_datelineCD, (E_datetime) AS E_datelineCD
            FROM Concerts 
            JOIN TypeConcert ON Concerts.Con_type = ID_Type_Con
            JOIN ShowTime ON Concerts.CID = ShowTime.CID
            JOIN TypeShow ON Concerts.Per_type = ID_Type_Show
            JOIN TicketInform ON Concerts.CID = TicketInform.CID
            JOIN TypeTicket ON TicketInform.Type = TypeTicket.TID
            JOIN ConcertDeals ON Concerts.CID = ConcertDeals.CID
            LEFT JOIN ConcertSendDeals ON ConcertDeals.CDID = ConcertSendDeals.CDID
            WHERE ConcertDeals.CDID = @CDID
        `);
        
        // Query hotel details
        const hotelDetails = await request.query(`
            SELECT MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel, MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                   (Hotels.ID_user) AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV, (PriceH) AS PriecH, 
                   (S_datetimeHD) AS S_datelineHD, (E_datetimeHD) AS E_datelineHD, NumOfRooms
            FROM HotelPicture
            JOIN RoomHotel ON HotelPicture.ID_hotel = RoomHotel.ID_hotel
            JOIN Hotels ON RoomHotel.ID_hotel = Hotels.ID_hotel
            JOIN RoomlPicture ON RoomHotel.ID_room = RoomlPicture.ID_room
            JOIN TypeRoom ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
            JOIN TypeView ON RoomHotel.Type_view = TypeView.ID_Type_Room
            JOIN HotelDeals ON RoomHotel.ID_room = HotelDeals.ID_room
            LEFT JOIN HotelSendDeals ON HotelDeals.HDID = HotelSendDeals.HDID
            WHERE HotelDeals.HDID = @HDID
            GROUP BY ID_user, NameH, AddressH, NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
        `);

        // Fetch the current date and time in proper format
        const currentTime = await request.query(`SELECT FORMAT(GETDATE(), 'yyyy-MM-dd HH:mm:ss') AS DateAction`);

        // Fetch Number_of_room from HotelDeals
        const hotelDealsResult = await request.query(`
            SELECT Number_of_room
            FROM HotelDeals
            WHERE HDID = @HDID
        `);

        if (hotelDealsResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).send('Hotel offer not found');
        }

        const { Number_of_room } = hotelDealsResult.recordset[0];

        // Fetch NumOfRooms from HotelSendDeals
        const hotelSendDealsResult = await request.query(`
            SELECT NumOfRooms
            FROM HotelSendDeals
            WHERE HDID = @HDID
        `);

        let NumOfRooms;
        if (hotelSendDealsResult.recordset.length === 0) {
            console.warn('Hotel send deal not found for HDID:', hdidValue);
            NumOfRooms = 0; // Set default value to 0 if no deal found
        } else {
            NumOfRooms = hotelSendDealsResult.recordset[0].NumOfRooms;
        }

        // Insert data into UserHistory
        await request
            .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
            .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
            .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
            .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
            .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
            .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
            .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
            .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
            .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
            .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
            .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
            .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
            .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
            .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
            .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
            .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
            .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
            .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
            .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
            .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
            .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
            .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
            .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
            .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
            .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
            .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
            .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
            .input('NumOfRooms',        sql.Int,     NumOfRooms)
            .input('DateAction',        sql.DateTime, currentTime.recordset[0].DateAction)  // เปลี่ยนจาก sql.Date เป็น sql.DateTime
            .query(`
                INSERT INTO UserHistory (
                    ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                    Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                    ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                    E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
                )
                VALUES (
                    @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                    @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 4, @ID_user_Hotel,
                    @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                    @NumOfRooms, 3, @DateAction
                );
        `);

        // Update Number_of_room in HotelDeals
        const updatedNumberOfRoom = Number_of_room + NumOfRooms;
        await request.input('updatedNumberOfRoom', sql.Int, updatedNumberOfRoom);
        await request.query(`
            UPDATE HotelDeals
            SET Number_of_room = @updatedNumberOfRoom
            WHERE HDID = @HDID
        `);

        // Update StatusHD in HotelDeals
        const updateResult = await request.query(`
            DELETE FROM HotelSendDeals
            WHERE HDID = @HDID

            DELETE FROM Deals
            WHERE HDID = @HDID AND CDID = @CDID
        `);

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(500).send('Failed to update StatusHD');
        }
        await transaction.commit();
        res.status(200).send('Hotel offer cancelled successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while processing your request');
    }
});


// Endpoint สำหรับแสดงข้อมูลจากหลายตารางโดยเช็คจาก ID_user
app.get('/package/:ID_user', async (req, res) => {
    const { ID_user } = req.params;
    const { search } = req.query; 
    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        let query = `
            SELECT		Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                        Packeage.ID_deals, Hotels.ID_hotel, Deals.HDID, Deals.CDID, (Hotels.ID_user) AS hotelIDUser, (Concerts.ID_user) AS concertIDUser,
                        HotelDeals.ID_room, ConcertDeals.CID,
                        CASE 
                            WHEN Hotels.ID_user = Concerts.ID_user THEN 'จับคู่โดยผู้ใช้เอง'
                            ELSE 'จับคู่กับผู้ใช้อื่น'
                        END AS Matching_Status,
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
            FROM		Packeage
            JOIN		Deals			ON Packeage.ID_deals	= Deals.ID_deals
            JOIN		HotelDeals		ON Deals.HDID			= HotelDeals.HDID
            JOIN		RoomHotel		ON HotelDeals.ID_room	= RoomHotel.ID_room
            JOIN		Hotels			ON RoomHotel.ID_hotel	= Hotels.ID_hotel
            JOIN		ConcertDeals	ON Deals.CDID			= ConcertDeals.CDID
            JOIN		Concerts		ON ConcertDeals.CID		= Concerts.CID
            JOIN		TicketInform	ON Concerts.CID			= TicketInform.CID
            WHERE		Concerts.ID_user = ${ID_user}
        `;

        if (search) {
            query += `
                AND (
                    Name                LIKE '%${search}%' OR
                    NameH               LIKE '%${search}%' OR
                    Number_of_ticket    LIKE '%${search}%' OR
                    Number_of_room      LIKE '%${search}%' OR
                    PriceH              LIKE '%${search}%' OR
                    Address             LIKE '%${search}%' OR
                    AddressH            LIKE '%${search}%' OR
                    Ticket_zone         LIKE '%${search}%' OR
                    Price               LIKE '%${search}%' OR

                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE '%${search}%'   OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE '%${search}%' 

                )
            `;
        }

        query += `
            GROUP BY	Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                        Packeage.ID_deals,Deals.HDID, Deals.CDID, Hotels.ID_hotel, Hotels.ID_user, Concerts.ID_user,
                        HotelDeals.ID_room, ConcertDeals.CID, Concerts.StartDate, Concerts.EndDate
        `;

        query += `
            UNION
            SELECT		Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                        Packeage.ID_deals, Hotels.ID_hotel, Deals.HDID, Deals.CDID, (Hotels.ID_user) AS hotelIDUser, (Concerts.ID_user) AS concertIDUser,
                        HotelDeals.ID_room, ConcertDeals.CID,
                        CASE 
                            WHEN Hotels.ID_user = Concerts.ID_user THEN 'จับคู่โดยผู้ใช้เอง'
                            ELSE 'จับคู่กับผู้ใช้อื่น'
                        END AS Matching_Status,
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
            FROM		Packeage
            JOIN		Deals			ON Packeage.ID_deals	= Deals.ID_deals
            JOIN		HotelDeals		ON Deals.HDID			= HotelDeals.HDID
            JOIN		RoomHotel		ON HotelDeals.ID_room	= RoomHotel.ID_room
            JOIN		Hotels			ON RoomHotel.ID_hotel	= Hotels.ID_hotel
            JOIN		ConcertDeals	ON Deals.CDID			= ConcertDeals.CDID
            JOIN		Concerts		ON ConcertDeals.CID		= Concerts.CID
            JOIN		TicketInform	ON Concerts.CID			= TicketInform.CID
            WHERE		Hotels.ID_user = ${ID_user}
            
        `;

        if (search) {
            query += `
                AND (
                    Name                LIKE '%${search}%' OR
                    NameH               LIKE '%${search}%' OR
                    Number_of_ticket    LIKE '%${search}%' OR
                    Number_of_room      LIKE '%${search}%' OR
                    PriceH              LIKE '%${search}%' OR
                    Address             LIKE '%${search}%' OR
                    AddressH            LIKE '%${search}%' OR
                    Ticket_zone         LIKE '%${search}%' OR
                    Price               LIKE '%${search}%' OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE '%${search}%'   OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE '%${search}%' 
                )
            `;
        }
        query += `
            GROUP BY	Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                        Packeage.ID_deals,Deals.HDID, Deals.CDID, Hotels.ID_hotel, Hotels.ID_user, Concerts.ID_user,
                        HotelDeals.ID_room, ConcertDeals.CID, Concerts.StartDate, Concerts.EndDate
        `;

        const result = await sql.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching data');
    }
});




app.delete('/delete-package', async (req, res) => {
    const { ID_deals } = req.body;
    if (!ID_deals) {
        return res.status(400).json({ message: 'Please provide an ID_deals' });
    }

    try {
        const transaction = new sql.Transaction();
        await transaction.begin();

        try {
            await transaction.request().query`
                DELETE FROM Packeage WHERE ID_deals = ${ID_deals}
            `;
            await transaction.request().query`
                DELETE FROM Deals WHERE ID_deals = ${ID_deals}
            `;
            await transaction.request().query`
                DELETE FROM HotelDeals 
                WHERE HDID = (SELECT HDID FROM Deals WHERE ID_deals = ${ID_deals})
            `;
            await transaction.request().query`
                DELETE FROM ConcertDeals 
                WHERE CDID = (SELECT CDID FROM Deals WHERE ID_deals = ${ID_deals})
            `;

            await transaction.commit();
            // ดำเนินการลบแพ็คเกจ
            res.status(200).json({ message: 'Package deleted successfully' });
            res.status(200).send('Package and related deals deleted successfully');
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Error deleting package:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/concertsdeals-you-status/:statusCD/:ID_user', async (req, res) => {
    const { statusCD, ID_user } = req.params;
    const { search } = req.query;  // Get the search query parameter

    try {
        // Base query
        let query = `
            SELECT      Poster, NameOS, CDID, Concerts.CID, Name, Number_of_ticket, PriceCD, S_datetime, E_datetime,
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(CAST(StartDate AS DATE), 'dd') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(CAST(EndDate AS DATE), 'dd') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datetime) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datetime) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datetime) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datetime) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datetime) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datetime) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(CAST(S_datetime AS DATE), 'dd') + ' ' +
                        CASE 
                            WHEN MONTH(S_datetime) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datetime) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datetime) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datetime) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datetime) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datetime) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datetime) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datetime) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datetime) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datetime) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datetime) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datetime) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datetime) + 543 AS NVARCHAR) AS S_datetime_TH, 

                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datetime) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datetime) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datetime) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datetime) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datetime) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datetime) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(CAST(E_datetime AS DATE), 'dd') + ' ' +
                        CASE 
                            WHEN MONTH(E_datetime) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datetime) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datetime) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datetime) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datetime) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datetime) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datetime) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datetime) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datetime) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datetime) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datetime) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datetime) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datetime) + 543 AS NVARCHAR) AS E_datetime_TH
            FROM        Concerts
            JOIN        ConcertDeals    ON Concerts.CID             = ConcertDeals.CID
            JOIN        OfferStatus     ON ConcertDeals.StatusCD    = OfferStatus.ID_Offer_Status
            WHERE       ConcertDeals.StatusCD   = ${statusCD}
            AND         Concerts.ID_user        = ${ID_user}
        `;

        // Add search condition if search query is provided
        if (search) {
            query += ` AND (
                NameOS              LIKE '%${search}%' OR
                Name                LIKE '%${search}%' OR
                Number_of_ticket    LIKE '%${search}%' OR
                PriceCD             LIKE '%${search}%' OR
                CASE 
				WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
				WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
				WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
				WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
				WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
				WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
				WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
			END + ' ' +
			FORMAT(CAST(StartDate AS DATE), 'dd') + ' ' +
			CASE 
				WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
				WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
				WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
				WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
				WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
				WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
				WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
				WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
				WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
				WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
				WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
				WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
			END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) LIKE '%${search}%' OR

			CASE 
				WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
				WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
				WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
				WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
				WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
				WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
				WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
			END + ' ' +
			FORMAT(CAST(EndDate AS DATE), 'dd') + ' ' +
			CASE 
				WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
				WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
				WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
				WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
				WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
				WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
				WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
				WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
				WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
				WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
				WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
				WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
			END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) LIKE '%${search}%' OR

			CASE 
				WHEN DATENAME(WEEKDAY, S_datetime) = 'Monday' THEN 'วันจันทร์'
				WHEN DATENAME(WEEKDAY, S_datetime) = 'Tuesday' THEN 'วันอังคาร'
				WHEN DATENAME(WEEKDAY, S_datetime) = 'Wednesday' THEN 'วันพุธ'
				WHEN DATENAME(WEEKDAY, S_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
				WHEN DATENAME(WEEKDAY, S_datetime) = 'Friday' THEN 'วันศุกร์'
				WHEN DATENAME(WEEKDAY, S_datetime) = 'Saturday' THEN 'วันเสาร์'
				WHEN DATENAME(WEEKDAY, S_datetime) = 'Sunday' THEN 'วันอาทิตย์'
			END + ' ' +
			FORMAT(CAST(S_datetime AS DATE), 'dd') + ' ' +
			CASE 
				WHEN MONTH(S_datetime) = 1 THEN 'มกราคม' 
				WHEN MONTH(S_datetime) = 2 THEN 'กุมภาพันธ์' 
				WHEN MONTH(S_datetime) = 3 THEN 'มีนาคม' 
				WHEN MONTH(S_datetime) = 4 THEN 'เมษายน' 
				WHEN MONTH(S_datetime) = 5 THEN 'พฤษภาคม' 
				WHEN MONTH(S_datetime) = 6 THEN 'มิถุนายน' 
				WHEN MONTH(S_datetime) = 7 THEN 'กรกฎาคม' 
				WHEN MONTH(S_datetime) = 8 THEN 'สิงหาคม' 
				WHEN MONTH(S_datetime) = 9 THEN 'กันยายน' 
				WHEN MONTH(S_datetime) = 10 THEN 'ตุลาคม' 
				WHEN MONTH(S_datetime) = 11 THEN 'พฤศจิกายน' 
				WHEN MONTH(S_datetime) = 12 THEN 'ธันวาคม' 
			END + ' ' + CAST(YEAR(S_datetime) + 543 AS NVARCHAR) LIKE '%${search}%' OR

			CASE 
				WHEN DATENAME(WEEKDAY, E_datetime) = 'Monday' THEN 'วันจันทร์'
				WHEN DATENAME(WEEKDAY, E_datetime) = 'Tuesday' THEN 'วันอังคาร'
				WHEN DATENAME(WEEKDAY, E_datetime) = 'Wednesday' THEN 'วันพุธ'
				WHEN DATENAME(WEEKDAY, E_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
				WHEN DATENAME(WEEKDAY, E_datetime) = 'Friday' THEN 'วันศุกร์'
				WHEN DATENAME(WEEKDAY, E_datetime) = 'Saturday' THEN 'วันเสาร์'
				WHEN DATENAME(WEEKDAY, E_datetime) = 'Sunday' THEN 'วันอาทิตย์'
			END + ' ' +
			FORMAT(CAST(E_datetime AS DATE), 'dd') + ' ' +
			CASE 
				WHEN MONTH(E_datetime) = 1 THEN 'มกราคม' 
				WHEN MONTH(E_datetime) = 2 THEN 'กุมภาพันธ์' 
				WHEN MONTH(E_datetime) = 3 THEN 'มีนาคม' 
				WHEN MONTH(E_datetime) = 4 THEN 'เมษายน' 
				WHEN MONTH(E_datetime) = 5 THEN 'พฤษภาคม' 
				WHEN MONTH(E_datetime) = 6 THEN 'มิถุนายน' 
				WHEN MONTH(E_datetime) = 7 THEN 'กรกฎาคม' 
				WHEN MONTH(E_datetime) = 8 THEN 'สิงหาคม' 
				WHEN MONTH(E_datetime) = 9 THEN 'กันยายน' 
				WHEN MONTH(E_datetime) = 10 THEN 'ตุลาคม' 
				WHEN MONTH(E_datetime) = 11 THEN 'พฤศจิกายน' 
				WHEN MONTH(E_datetime) = 12 THEN 'ธันวาคม' 
			END + ' ' + CAST(YEAR(E_datetime) + 543 AS NVARCHAR) LIKE '%${search}%' 
            )`;
        }

        const result = await sql.query(query);

        if (result.recordset.length === 0) {
            res.status(404).send('No concert deals found for the given StatusCD');
            return;
        }

        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching concert deals:', err);
        res.status(500).send('Internal server error');
    }
});




// Endpoint สำหรับดึงข้อมูลจาก Hotels และ  HotelDeals โดยเช็คจาก ID_user
app.get('/hoteldeals-not-approved-u/:ID_user', async (req, res) => {
    const ID_user = req.params.ID_user;
    const { search } = req.query; // รับค่าพารามิเตอร์ search

    try {
        // สร้าง connection
        const pool = await sql.connect();
        const request = pool.request();

        // กำหนดตัวแปรพื้นฐานที่ต้องการ
        request.input('ID_user', sql.Int, ID_user);

        // สร้าง query เริ่มต้น
        let query = `
            SELECT  MIN(RoomlPicture.Img_Url_room) AS MinImg_Url_Hotel,  -- ดึงรูปภาพห้องที่มี URL ต่ำสุด (เพื่อดึงรูปแรก)
                    NameH, Hotels.ID_hotel, HDID, Number_of_room, S_datetimeHD, E_datetimeHD, Status_room, StatusHD, NameTR, NameTV, Total,
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(S_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(S_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datetimeHD) + 543 AS NVARCHAR) AS S_datetimeHD_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(E_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(E_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(E_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(E_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(E_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(E_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(E_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(E_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(E_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(E_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(E_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(E_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(E_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(E_datetimeHD) + 543 AS NVARCHAR) AS E_datetimeHD_TH
            FROM    Hotels
            INNER   JOIN RoomHotel		ON Hotels.ID_hotel      = RoomHotel.ID_hotel
            INNER   JOIN HotelDeals		ON HotelDeals.ID_room   = RoomHotel.ID_room
            INNER   JOIN RoomlPicture	ON RoomHotel.ID_room    = RoomlPicture.ID_room
            INNER	JOIN TypeRoom		ON RoomHotel.Type_room  = TypeRoom.ID_Type_Room
            INNER	JOIN TypeView		ON RoomHotel.Type_view  = TypeView.ID_Type_Room 
            WHERE   HotelDeals.StatusHD = 1
            AND     Hotels.ID_user = @ID_user
        `;

        // ตรวจสอบว่ามีการส่งพารามิเตอร์ search หรือไม่
        if (search) {
            // แยกคำค้นจาก search และสร้างเงื่อนไขเพิ่มเติมใน SQL
            query += ` AND (
                NameH           LIKE @search OR
                HDID            LIKE @search OR
                CAST(Number_of_room AS VARCHAR) LIKE @search OR  -- ใช้ CAST เพื่อให้แน่ใจว่า Number_of_room เป็น string
                Status_room     LIKE @search OR
                Total           LIKE @search OR
                StatusHD        LIKE @search OR
                NameTR          LIKE @search OR
                NameTV          LIKE @search OR
                CASE 
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(S_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(S_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datetimeHD) + 543 AS NVARCHAR) LIKE @search OR

                    CASE 
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(CAST(E_datetimeHD AS DATE), 'dd') + ' ' +
                    CASE 
                        WHEN MONTH(E_datetimeHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(E_datetimeHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(E_datetimeHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(E_datetimeHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(E_datetimeHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(E_datetimeHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(E_datetimeHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(E_datetimeHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(E_datetimeHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(E_datetimeHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(E_datetimeHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(E_datetimeHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(E_datetimeHD) + 543 AS NVARCHAR) LIKE @search

            )`;
            request.input('search', sql.NVarChar, `%${search}%`); // ตั้งค่าตัวแปร search
        }

        // เพิ่ม GROUP BY
        query += `
            GROUP BY NameH, Hotels.ID_hotel, HDID, Number_of_room, S_datetimeHD, E_datetimeHD, Status_room, StatusHD, NameTR, NameTV, Total
        `;

        // Query ข้อมูลจากฐานข้อมูล
        const result = await request.query(query);

        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No hotel deals found' });
        }

        // ส่งผลลัพธ์เป็น JSON
        res.json(result.recordset);
    } catch (err) {
        // แสดงข้อผิดพลาดเพิ่มเติมใน console และส่ง response ไปยัง client
        console.error('Error querying the database:', err.message);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});


app.get('/hoteldeals-not-approved-c/:HDID', async (req, res) => {
    const HDID = req.params.HDID;
    const { search } = req.query; // รับค่าพารามิเตอร์ search

    try {
        // สร้าง connection
        const pool = await sql.connect();
        const request = pool.request();

        // กำหนดตัวแปรพื้นฐานที่ต้องการ
        request.input('HDID', sql.Int, HDID);

        // สร้าง query เริ่มต้น
        let query = `
            SELECT  MIN(RoomlPicture.Img_Url_room) AS MinImg_Url_Hotel,  -- ดึงรูปภาพห้องที่มี URL ต่ำสุด (เพื่อดึงรูปแรก)
                    NameH, Hotels.ID_hotel, HDID, S_datetimeHD, E_datetimeHD, Status_room, StatusHD, NameTR, NameTV,
                    Number_of_room
            FROM    Hotels
            INNER   JOIN RoomHotel		ON Hotels.ID_hotel      = RoomHotel.ID_hotel
            INNER   JOIN HotelDeals		ON HotelDeals.ID_room   = RoomHotel.ID_room
            INNER   JOIN RoomlPicture	ON RoomHotel.ID_room    = RoomlPicture.ID_room
            INNER	JOIN TypeRoom		ON RoomHotel.Type_room  = TypeRoom.ID_Type_Room
            INNER	JOIN TypeView		ON RoomHotel.Type_view  = TypeView.ID_Type_Room 
            WHERE   HotelDeals.StatusHD = 1
            AND     HotelDeals.HDID = @HDID
        `;

        // ตรวจสอบว่ามีการส่งพารามิเตอร์ search หรือไม่
        if (search) {
            // แยกคำค้นจาก search และสร้างเงื่อนไขเพิ่มเติมใน SQL
            query += ` AND (
                NameH           LIKE @search OR
                HDID            LIKE @search OR
                CAST(Number_of_room AS VARCHAR) LIKE @search OR  
                CONVERT(VARCHAR, S_datetimeHD, 120) LIKE @search OR 
                CONVERT(VARCHAR, E_datetimeHD, 120) LIKE @search OR
                Status_room     LIKE @search OR
                StatusHD        LIKE @search OR
                NameTR          LIKE @search OR
                NameTV          LIKE @search
            )`;
            request.input('search', sql.NVarChar, `%${search}%`); // ตั้งค่าตัวแปร search
        }

        // เพิ่ม GROUP BY
        query += `
            GROUP BY NameH, Hotels.ID_hotel, HDID, S_datetimeHD, E_datetimeHD, Status_room, StatusHD, NameTR, NameTV, Number_of_room
        `;

        // Query ข้อมูลจากฐานข้อมูล
        const result = await request.query(query);

        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No hotel deals found' });
        }

        // ส่งผลลัพธ์เป็น JSON
        res.json(result.recordset);
    } catch (err) {
        // แสดงข้อผิดพลาดเพิ่มเติมใน console และส่ง response ไปยัง client
        console.error('Error querying the database:', err.message);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});


app.post('/add-deals-update-insert-cdid', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD, Deadline_package, S_Deadline_package, NumOfRooms, Number_of_room } = req.body;

    // Validate required fields
    if (!HDID || !CDID || !Datetime_match || !StatusD || !Deadline_package || !S_Deadline_package || !NumOfRooms || !Number_of_room) {
        return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, StatusD, Deadline_package, S_Deadline_package, NumOfRooms ,and Number_of_room.');
    }

    // Additional validations
    if (typeof HDID !== 'number' || typeof CDID !== 'number' || typeof StatusD !== 'number' || typeof NumOfRooms !== 'number' || typeof Number_of_room !== 'number') {
        return res.status(400).send('HDID, CDID, StatusD, and NumOfRooms must be numbers.');
    }

    if (NumOfRooms <= 0) {
        return res.status(400).send('NumOfRooms must be a positive integer.');
    }

    if (NumOfRooms !== Number_of_room) {
        return res.status(400).send(
            `Invalid input. NumOfRooms (${NumOfRooms}) must match the Number_of_room (${Number_of_room}). Please try again.`
        );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/; // ISO 8601 format
    if (!dateRegex.test(Datetime_match) || !dateRegex.test(Deadline_package) || !dateRegex.test(S_Deadline_package)) {
        return res.status(400).send('Datetime_match, Deadline_package, and S_Deadline_package must be in the format YYYY-MM-DDTHH:mm:ss.');
    }

    // Create a new transaction
    const transaction = new sql.Transaction();

    try {
        await transaction.begin();
        
        const request1 = new sql.Request(transaction);

        // Set parameters for request1
        request1.input('HDID', sql.Int, HDID);
        request1.input('CDID', sql.Int, CDID);
        request1.input('Datetime_match', sql.DateTime, new Date(Datetime_match)); // convert to Date object
        request1.input('StatusD', sql.Int, StatusD);

        // Insert into Deals table
        const result1 = await request1.query(`
            INSERT INTO Deals (HDID, CDID, Datetime_match, StatusD)
            OUTPUT INSERTED.ID_deals
            VALUES (@HDID, @CDID, @Datetime_match, @StatusD)
        `);

        const ID_deals = result1.recordset[0].ID_deals;

        const request2 = new sql.Request(transaction);

        // Set parameters for request2
        request2.input('CDID', sql.Int, CDID);
        request2.input('HDID', sql.Int, HDID);
        request2.input('ID_deals', sql.Int, ID_deals);
        request2.input('Deadline_package', sql.DateTime, new Date(Deadline_package)); // convert to Date object
        request2.input('S_Deadline_package', sql.DateTime, new Date(S_Deadline_package)); // convert to Date object
        request2.input('NumOfRooms', sql.Int, NumOfRooms);

        // Update ConcertDeals table
        await request2.query(`
            UPDATE ConcertDeals
            SET StatusCD = 2
            WHERE CDID = @CDID
        `);

        // Insert into HotelSendDeals table
        await request2.query(`
            INSERT INTO HotelSendDeals (HDID, StatusHD, NumOfRooms)
            VALUES (@HDID, 2, @NumOfRooms)
        `);

        // Insert into Package table
        await request2.query(`
            INSERT INTO Packeage (ID_deals, Deadline_package, S_Deadline_package)
            VALUES (@ID_deals, @Deadline_package, @S_Deadline_package)
        `);

        // Update HotelDeals table
        await request2.query(`
            UPDATE HotelDeals
            SET Number_of_room = Number_of_room + @NumOfRooms
            WHERE HDID = @HDID
        `);
        

        const concertDetails = await request2.query(`
                SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                FROM		Concerts 
                JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                WHERE		ConcertDeals.CDID = @CDID
            `);
        
            const hotelDetails = await request2.query(`
                SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD
                FROM			HotelPicture
                JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                WHERE			HotelDeals.HDID = @HDID
                GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD
            `);

            const CurrentTime = await request2.query(`
                SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') AS DateAction
            `);

            await request2
                .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
                .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
                .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
                .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
                .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
                .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
                .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
                .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
                .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
                .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
                .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
                .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
                .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
                .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
                .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
                .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
                .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
                .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
                .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
                .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
                .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
                .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
                .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
                .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
                .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
                .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
                .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
                .input('DateAction',        sql.Date,    CurrentTime.recordset[0].DateAction)
                .query(`
                    INSERT INTO UserHistory (
                        ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                        Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                        ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                        E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
                    )
                    VALUES (
                        @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                        @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 1, @ID_user_Hotel,
                        @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                        @NumOfRooms, 1, @DateAction
                    );
                `);
        // Commit the transaction
        await transaction.commit();
        res.status(201).send('Deal added, ConcertDeals status updated, and Package created successfully.');
    } catch (err) {
        await transaction.rollback();
        console.error('Error adding deal, updating ConcertDeals status, and creating Package:', err);
        res.status(500).send('Internal server error.');
    }
});


app.get('/hotel-and-search', async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT  MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,
                    Hotels.ID_hotel,
                    NameH,  
                    NameTH,
                    MIN(TypeRoom.NameTR) AS NameTR,
                    MIN(TypeView.NameTV) AS NameTV,
                    AddressH,
                    MIN(RoomHotel.PriceH) AS MinPriceH,  
                    MAX(RoomHotel.PriceH) AS MaxPriceH, 
                    NameRS
            FROM    Hotels
            JOIN    RoomHotel       ON Hotels.ID_hotel        = RoomHotel.ID_hotel
            JOIN    TypeHotel       ON Hotels.Type_hotel      = TypeHotel.ID_Type_Hotel
            JOIN    TypeRoom        ON RoomHotel.Type_room    = TypeRoom.ID_Type_Room
            JOIN    TypeView        ON RoomHotel.Type_view    = TypeView.ID_Type_Room
            JOIN    HotelPicture    ON Hotels.ID_hotel        = HotelPicture.ID_hotel
            JOIN    RoomStatus      ON RoomHotel.Status_room  = RoomStatus.ID_Room_Status
        `;

        if (search) {
            query += `
                WHERE NameH     LIKE '%${search}%' OR
                    NameTH      LIKE '%${search}%' OR
                    NameTR      LIKE '%${search}%' OR
                    NameTV      LIKE '%${search}%' OR
                    AddressH    LIKE '%${search}%' OR
                    PriceH      LIKE '%${search}%' OR
                    NameRS      LIKE '%${search}%'
            `;
        }

        query += ' GROUP BY Hotels.ID_hotel, NameH, NameTH, AddressH, NameRS';

        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching hotel data:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/concert-and-search', async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT	Concerts.CID, Poster, Name, Address, Ticket_zone, Price,NameT, NameTC, Time, NameTS
			FROM	Concerts
			JOIN	TicketInform    ON Concerts.CID       = TicketInform.CID
			JOIN	TypeTicket      ON TicketInform.Type  = TypeTicket.TID
            JOIN	ShowTime        ON Concerts.CID       = ShowTime.CID
            JOIN    TypeConcert     ON Concerts.Con_type  = TypeConcert.ID_Type_Con
            JOIN    TypeShow        ON Concerts.Per_type  = TypeShow.ID_Type_Show
        `;

        if (search) {
            query += `
                WHERE Name          LIKE '%${search}%' OR
                    Address         LIKE '%${search}%' OR
                    Ticket_zone     LIKE '%${search}%' OR
                    NameT           LIKE '%${search}%' OR
                    NameTC          LIKE '%${search}%' OR
                    Time            LIKE '%${search}%' OR
                    NameTS          LIKE '%${search}%' 
            `;
        }

        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching hotel data:', err);
        res.status(500).send('Internal server error');
    }
});



app.get('/type-concert-id', async (req, res) => {
    const { Con_type } = req.query;

    if (!Con_type) {
        return res.status(400).send('Please provide a Con_type');
    }

    try {
        const result = await sql.query`
            SELECT  ID_Type_Con, NameTC
            FROM    TypeConcert
            WHERE   ID_Type_Con = ${Con_type}
        `;
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching type concert data:', err);
        res.status(500).send('Internal server error');
    }
});


app.put('/editshowtime', async (req, res) => {
    const { CID, Time } = req.body;

    if (!CID || !Time) {
        return res.status(400).send('Please provide both CID and Time');
    }

    try {
        await sql.query`
            UPDATE ShowTime
            SET Time = ${Time}
            WHERE CID = ${CID}
        `;
        res.status(200).send('ShowTime updated successfully');
    } catch (err) {
        console.error('Error updating ShowTime:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/count-hotel-offers', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        const result = await sql.query`
            WITH	RankedDeals AS 
                    (
                        SELECT		HotelDeals.HDID,Name,  NameH, RoomHotel.ID_room, ConcertDeals.CDID, 
                                    RoomlPicture.Img_Url_room AS MinImg_Url_Hotel, NameTH, NameTR, NumOfRooms, PriceH, S_datetimeHD, E_datetimeHD,
                                    RoomHotel.ID_hotel, NameTV, Deals.ID_deals, 
                                    ROW_NUMBER() OVER 
                                        (
                                            PARTITION BY	HotelDeals.HDID, RoomHotel.ID_room 
                                            ORDER BY		RoomlPicture.Img_Url_room
                                        ) 
                                    AS rn
                        FROM		Deals
                        LEFT JOIN	HotelDeals		ON Deals.HDID			= HotelDeals.HDID
                        LEFT JOIN	RoomHotel		ON HotelDeals.ID_room	= RoomHotel.ID_room
                        LEFT JOIN	Hotels			ON RoomHotel.ID_hotel	= Hotels.ID_hotel
                        LEFT JOIN	TypeHotel		ON Hotels.Type_hotel	= TypeHotel.ID_Type_Hotel
                        LEFT JOIN	TypeView		ON RoomHotel.Type_view	= TypeView.ID_Type_Room
                        LEFT JOIN	TypeRoom		ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
                        LEFT JOIN	RoomlPicture	ON RoomHotel.ID_room	= RoomlPicture.ID_room
                        LEFT JOIN	HotelSendDeals	ON HotelDeals.HDID		= HotelSendDeals.HDID
                        LEFT JOIN	ConcertDeals	ON Deals.CDID			= ConcertDeals.CDID
                        LEFT JOIN	Concerts		ON ConcertDeals.CID		= Concerts.CID
                        WHERE		Deals.StatusD = 1
                        AND			(ConcertDeals.StatusCD = 1		OR ConcertDeals.CDID IS NULL)
                        AND			(HotelDeals.StatusHD = 2		OR HotelDeals.HDID IS NULL)
                        AND			(HotelSendDeals.StatusHD = 2	OR HotelSendDeals.HDID IS NULL)
                        AND			(Concerts.ID_user = ${ID_user}	OR Concerts.ID_user IS NULL)
                                    
                    )
                SELECT	COUNT(*) AS offerCountHotel
                FROM	RankedDeals
                WHERE	rn = 1
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching hotel offers:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/count-concert-offers', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        const result = await sql.query`
            SELECT  COUNT(*) as offerCount
            FROM    Deals
            JOIN    HotelDeals          ON Deals.HDID           = HotelDeals.HDID
            JOIN    RoomHotel           ON HotelDeals.ID_room   = RoomHotel.ID_room
            JOIN    Hotels              ON RoomHotel.ID_hotel   = Hotels.ID_hotel
            JOIN	TypeRoom			ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
            JOIN	TypeView			ON RoomHotel.Type_view	= TypeView.ID_Type_Room
            JOIN    ConcertDeals        ON Deals.CDID           = ConcertDeals.CDID
            JOIN    Concerts            ON ConcertDeals.CID     = Concerts.CID
            JOIN	ConcertSendDeals    ON ConcertDeals.CDID    = ConcertSendDeals.CDID
            WHERE   Deals.StatusD       = 1
            AND     HotelDeals.StatusHD = 1
            AND     Hotels.ID_user      = ${ID_user}
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching concert offers:', err);
        res.status(500).send('Internal server error');
    }
});



app.get('/notifications', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        await sql.connect(dbConfig);

        const resultHotelOffers = await sql.query`
            WITH RankedDeals AS 
                (
                    SELECT HotelDeals.HDID, Name, NameH, RoomHotel.ID_room, ConcertDeals.CDID, 
                        RoomlPicture.Img_Url_room AS MinImg_Url_Hotel, NameTH, NameTR, NumOfRooms, PriceH, S_datetimeHD, E_datetimeHD,
                        RoomHotel.ID_hotel, NameTV, Deals.ID_deals, 
                        ROW_NUMBER() OVER 
                            (
                                PARTITION BY HotelDeals.HDID, RoomHotel.ID_room 
                                ORDER BY RoomlPicture.Img_Url_room
                            ) 
                        AS rn
                    FROM Deals
                    LEFT JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
                    LEFT JOIN RoomHotel ON HotelDeals.ID_room = RoomHotel.ID_room
                    LEFT JOIN Hotels ON RoomHotel.ID_hotel = Hotels.ID_hotel
                    LEFT JOIN TypeHotel ON Hotels.Type_hotel = TypeHotel.ID_Type_Hotel
                    LEFT JOIN TypeView ON RoomHotel.Type_view = TypeView.ID_Type_Room
                    LEFT JOIN TypeRoom ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
                    LEFT JOIN RoomlPicture ON RoomHotel.ID_room = RoomlPicture.ID_room
                    LEFT JOIN HotelSendDeals ON HotelDeals.HDID = HotelSendDeals.HDID
                    LEFT JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
                    LEFT JOIN Concerts ON ConcertDeals.CID = Concerts.CID
                    WHERE Deals.StatusD = 1
                    AND (ConcertDeals.StatusCD = 1 OR ConcertDeals.CDID IS NULL)
                    AND (HotelDeals.StatusHD = 2 OR HotelDeals.HDID IS NULL)
                    AND (HotelSendDeals.StatusHD = 2 OR HotelSendDeals.HDID IS NULL)
                    AND (Concerts.ID_user = ${ID_user} OR Concerts.ID_user IS NULL)
                )
            SELECT COUNT(*) AS offerCountHotel
            FROM RankedDeals
            WHERE rn = 1
        `;

        const resultConcertOffers = await sql.query`
            SELECT COUNT(*) as offerCount
            FROM Deals
            JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
            JOIN RoomHotel ON HotelDeals.ID_room = RoomHotel.ID_room
            JOIN Hotels ON RoomHotel.ID_hotel = Hotels.ID_hotel
            JOIN TypeRoom ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
            JOIN TypeView ON RoomHotel.Type_view = TypeView.ID_Type_Room
            JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
            JOIN Concerts ON ConcertDeals.CID = Concerts.CID
            JOIN ConcertSendDeals ON ConcertDeals.CDID = ConcertSendDeals.CDID
            WHERE Deals.StatusD = 1
            AND HotelDeals.StatusHD = 1
            AND Hotels.ID_user = ${ID_user}
        `;

        const resultCancelHotelOffers = await sql.query`
            WITH	RankedDeals AS 
            (
            SELECT		HotelDeals.HDID, NameH, RoomHotel.ID_room, ConcertDeals.CDID, 
                        RoomlPicture.Img_Url_room AS MinImg_Url_Hotel, NameTH, NameTR, Number_of_room, PriceH,
                        RoomHotel.ID_hotel, NameTV, Deals.ID_deals,Name, Number_of_ticket, PriceCD, Poster, Concerts.CID, 
                        Con_NumOfRooms, NumOfRooms,
                        CASE 
                                WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                                WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                                WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                                WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                                WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                                WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                                WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                            END + ' ' +
                            FORMAT(CONVERT(datetime, S_datetimeHD), 'dd', 'th-TH') + ' ' +
                            CASE 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 1 THEN 'มกราคม' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 2 THEN 'กุมภาพันธ์' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 3 THEN 'มีนาคม' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 4 THEN 'เมษายน' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 5 THEN 'พฤษภาคม' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 6 THEN 'มิถุนายน' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 7 THEN 'กรกฎาคม' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 8 THEN 'สิงหาคม' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 9 THEN 'กันยายน' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 10 THEN 'ตุลาคม' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 11 THEN 'พฤศจิกายน' 
                                WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 12 THEN 'ธันวาคม' 
                            END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetimeHD)) + 543 AS NVARCHAR) AS S_datetimeHD_TH, 

                            CASE 
                                WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                                WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                                WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                                WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                                WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                                WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                                WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                            END + ' ' +
                            FORMAT(CONVERT(datetime, E_datetimeHD), 'dd', 'th-TH') + ' ' +
                            CASE 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 1 THEN 'มกราคม' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 2 THEN 'กุมภาพันธ์' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 3 THEN 'มีนาคม' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 4 THEN 'เมษายน' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 5 THEN 'พฤษภาคม' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 6 THEN 'มิถุนายน' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 7 THEN 'กรกฎาคม' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 8 THEN 'สิงหาคม' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 9 THEN 'กันยายน' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 10 THEN 'ตุลาคม' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 11 THEN 'พฤศจิกายน' 
                                WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 12 THEN 'ธันวาคม' 
                            END + ' ' + CAST(YEAR(CONVERT(datetime, E_datetimeHD)) + 543 AS NVARCHAR) AS E_datetimeHD_TH,
                        ROW_NUMBER() OVER 
                            (
                                PARTITION BY	HotelDeals.HDID, RoomHotel.ID_room 
                                ORDER BY		RoomlPicture.Img_Url_room
                            ) 
                        AS rn
            FROM		Deals
            LEFT JOIN	HotelDeals			ON Deals.HDID			= HotelDeals.HDID
            LEFT JOIN	RoomHotel			ON HotelDeals.ID_room	= RoomHotel.ID_room
            LEFT JOIN	Hotels				ON RoomHotel.ID_hotel	= Hotels.ID_hotel
            LEFT JOIN	TypeHotel			ON Hotels.Type_hotel	= TypeHotel.ID_Type_Hotel
            LEFT JOIN	TypeView			ON RoomHotel.Type_view	= TypeView.ID_Type_Room
            LEFT JOIN	TypeRoom			ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
            LEFT JOIN	RoomlPicture		ON RoomHotel.ID_room	= RoomlPicture.ID_room
            LEFT JOIN	ConcertDeals		ON Deals.CDID			= ConcertDeals.CDID
            LEFT JOIN	Concerts			ON ConcertDeals.CID		= Concerts.CID
            LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
            LEFT JOIN	HotelSendDeals		ON HotelDeals.HDID		= HotelSendDeals.HDID
            WHERE		Deals.StatusD = 3
            AND			(HotelSendDeals.StatusHD = 3		OR HotelSendDeals.HDID IS NULL)
            AND			(Concerts.ID_user = ${ID_user}	OR Concerts.ID_user IS NULL)
                                                                    
            )
            SELECT	COUNT(*) AS CountHotel_cancel
            FROM	RankedDeals
            WHERE	rn = 1
        `;

        const resultCancelConcertOffers = await sql.query`
            SELECT COUNT(*) as CountConcert_cancel
            FROM Deals
            JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
            JOIN RoomHotel ON HotelDeals.ID_room = RoomHotel.ID_room
            JOIN Hotels ON RoomHotel.ID_hotel = Hotels.ID_hotel
            JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
            JOIN Concerts ON ConcertDeals.CID = Concerts.CID
            WHERE Deals.StatusD = 3
            AND ConcertDeals.StatusCD = 3
            AND Hotels.ID_user = ${ID_user}
        `;

        const hotelOffersCount = resultHotelOffers.recordset[0]?.offerCountHotel || 0;
        const concertOffersCount = resultConcertOffers.recordset.reduce((acc, row) => acc + (row.offerCount || 0), 0);
        const hotelCancelOffersCount = resultCancelHotelOffers.recordset.reduce((acc, row) => acc + (row.CountHotel_cancel || 0), 0);
        const concertCancelOffersCount = resultCancelConcertOffers.recordset.reduce((acc, row) => acc + (row.CountConcert_cancel || 0), 0);

        const totalOffersCount = hotelOffersCount + concertOffersCount + hotelCancelOffersCount + concertCancelOffersCount;

        res.status(200).json({
            totalOffersCount // Returning only the total offers count
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/concerts', async (req, res) => {
    const { ID_user, Show_secheduld, Poster, Name, LineUP, Con_type
            , Quantity_date, Address, Detail, Per_type, StartDate, EndDate } = req.body;

    // Debugging: ตรวจสอบข้อมูลที่รับจากคำขอ
    console.log('Received data:', { ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, 
                                    Quantity_date, Address, Detail, Per_type, StartDate, EndDate });

    // Validate required fields
    if (!ID_user || !Show_secheduld || !Poster || !Name || !LineUP || !Con_type  || !Quantity_date || !Address || !Detail || !Per_type || !StartDate || !EndDate) {
        console.log('Validation failed:', { ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Quantity_date, Address, Detail, Per_type, StartDate, EndDate });
        return res.status(400).send('All fields are required.');
    }

    try {
        const request = new sql.Request();
        
        // Set parameters for SQL query
        request.input('ID_user',        sql.Int,        ID_user);
        request.input('Show_secheduld', sql.VarChar,    Show_secheduld);
        request.input('Poster',         sql.VarChar,    Poster);
        request.input('Name',           sql.VarChar,    Name);
        request.input('LineUP',         sql.Text,       LineUP);
        request.input('Con_type',       sql.Int,        Con_type);
        request.input('Quantity_date',  sql.Int,        Quantity_date);
        request.input('Address',        sql.VarChar,    Address);
        request.input('Detail',         sql.Text,       Detail);
        request.input('Per_type',       sql.Int,        Per_type);
        request.input('StartDate',      sql.Date,       StartDate);
        request.input('EndDate',        sql.Date,       EndDate);

        // SQL query to insert data into Concerts table
        const query = `
            INSERT INTO Concerts (ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Quantity_date, Address, Detail, Per_type, StartDate, EndDate)
            VALUES (@ID_user, @Show_secheduld, @Poster, @Name, @LineUP, @Con_type, @Quantity_date, @Address, @Detail, @Per_type, @StartDate, @EndDate );
        `;

        // Execute the query with async/await
        const result = await request.query(query);
        console.log('Data inserted successfully.');
        res.status(201).send('Data inserted successfully.');
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/type-show', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT  ID_Type_Show, NameTS
            FROM    TypeShow
        `;
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching Per types data:', err);
        res.status(500).send('Internal server error');
    }
});

app.get('/type-concert', async (req, res) => {
    try {
        const result = await sql.query('SELECT ID_Type_Con, NameTC FROM TypeConcert');
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching type concert data:', err);
        res.status(500).send('Internal server error');
    }
});

app.get('/type-per', async (req, res) => {
    try {
        const result = await sql.query('SELECT ID_Type_Show, NameTS FROM TypeShow');
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching type concert data:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/login-admin', async (req, res) => {
    const { Email, Password } = req.body;

    try {
      console.log('Email:', Email, 'Password:', Password);  // เพิ่มการพิมพ์ข้อมูล Email และ Password

    const userResult = await sql.query`
        SELECT ID_user, Password FROM Users WHERE Email = ${Email}
    `;

      console.log('User Result:', userResult.recordset);  // พิมพ์ผลลัพธ์จากฐานข้อมูล

    if (userResult.recordset.length === 0) {
        return res.status(400).json({ message: 'Invalid Email or Password' });
    }

    const { ID_user, Password: hashedPassword } = userResult.recordset[0];

    const isPasswordMatch = await bcrypt.compare(Password, hashedPassword);
    if (!isPasswordMatch) {
        return res.status(400).json({ message: 'Invalid Email or Password' });
    }

    const AdminResult = await sql.query`
        SELECT * FROM Admin WHERE ID_user = ${ID_user}
    `;

      console.log('Admin Result:', AdminResult.recordset);  // พิมพ์ผลลัพธ์จากฐานข้อมูล

    if (AdminResult.recordset.length === 0) {
        return res.status(400).json({ message: 'User is not authorized' });
    }

    res.status(200).json({ message: 'Login successful', ID_user });
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/admin-room-status', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT ID_Room_Status, NameRS FROM RoomStatus';
    if (search) {
        query += ` WHERE NameRS LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching room status:', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-room-status', async (req, res) => {
    const { NameRS } = req.body;

    if (!NameRS) {
        return res.status(400).send('Please provide NameRS');
    }

    try {
        await sql.query`
            INSERT INTO RoomStatus (NameRS)
            VALUES (${NameRS})
        `;
        res.status(201).send('Room status added successfully');
    } catch (err) {
        console.error('Error adding room status:', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-room-status/:id', async (req, res) => {
    const { id } = req.params;
    const { NameRS } = req.body;

    if (!NameRS) {
        return res.status(400).send('Please provide NameRS');
    }

    try {
        await sql.query`
            UPDATE  RoomStatus
            SET     NameRS = ${NameRS}
            WHERE   ID_Room_Status = ${id}
        `;
        res.status(200).send('Room status updated successfully');
    } catch (err) {
        console.error('Error updating room status:', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-room-status/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM RoomStatus
            WHERE   ID_Room_Status = ${id}
            AND     ID_Room_Status NOT IN (1, 2, 3, 4);
        `;
        res.status(200).send('Room status deleted successfully');
    } catch (err) {
        console.error('Error deleting room status:', err);
        res.status(500).send('Internal server error');
    }
});



app.get('/admin-type-concert', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT ID_Type_Con, NameTC FROM TypeConcert';
    if (search) {
        query += ` WHERE NameTC LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-type-concert', async (req, res) => {
    const { NameTC } = req.body;

    if (!NameTC) {
        return res.status(400).send('Please provide NameTC');
    }

    try {
        await sql.query`
            INSERT INTO TypeConcert (NameTC)
            VALUES (${NameTC})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-type-concert/:id', async (req, res) => {
    const { id } = req.params;
    const { NameTC } = req.body;

    if (!NameTC) {
        return res.status(400).send('Please provide NameTC');
    }

    try {
        await sql.query`
            UPDATE  TypeConcert
            SET     NameTC = ${NameTC}
            WHERE   ID_Type_Con = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-type-concert/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM TypeConcert
            WHERE   ID_Type_Con = ${id}
            AND     ID_Type_Con NOT IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,21,23,24,25,26,27,28);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/admin-type-show', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT ID_Type_Show, NameTS FROM TypeShow';
    if (search) {
        query += ` WHERE NameTS LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-type-show', async (req, res) => {
    const { NameTS } = req.body;

    if (!NameTS) {
        return res.status(400).send('Please provide NameTS');
    }

    try {
        await sql.query`
            INSERT INTO TypeShow (NameTS)
            VALUES (${NameTS})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-type-show/:id', async (req, res) => {
    const { id } = req.params;
    const { NameTS } = req.body;

    if (!NameTS) {
        return res.status(400).send('Please provide NameTS');
    }

    try {
        await sql.query`
            UPDATE  TypeShow
            SET     NameTS = ${NameTS}
            WHERE   ID_Type_Show = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-type-show/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM TypeShow
            WHERE   ID_Type_Show = ${id}
            AND     ID_Type_Show NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ,11);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});




app.get('/admin-type-ticket', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT TID, NameT FROM TypeTicket';
    if (search) {
        query += ` WHERE NameT LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-type-ticket', async (req, res) => {
    const { NameT } = req.body;

    if (!NameT) {
        return res.status(400).send('Please provide NameT');
    }

    try {
        await sql.query`
            INSERT INTO TypeTicket (NameT)
            VALUES (${NameT})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-type-ticket/:id', async (req, res) => {
    const { id } = req.params;
    const { NameT } = req.body;

    if (!NameT) {
        return res.status(400).send('Please provide NameT');
    }

    try {
        await sql.query`
            UPDATE  TypeTicket
            SET     NameT = ${NameT}
            WHERE   TID = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-type-ticket/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM TypeTicket
            WHERE   TID = ${id}
            AND     TID NOT IN (1, 2, 3);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});




app.get('/admin-type-hotel', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT ID_Type_Hotel, NameTH FROM TypeHotel';
    if (search) {
        query += ` WHERE NameTH LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-type-hotel', async (req, res) => {
    const { NameTH } = req.body;

    if (!NameTH) {
        return res.status(400).send('Please provide NameTH');
    }

    try {
        await sql.query`
            INSERT INTO TypeHotel (NameTH)
            VALUES (${NameTH})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-type-hotel/:id', async (req, res) => {
    const { id } = req.params;
    const { NameTH } = req.body;

    if (!NameTH) {
        return res.status(400).send('Please provide NameTH');
    }

    try {
        await sql.query`
            UPDATE  TypeHotel
            SET     NameTH = ${NameTH}
            WHERE   ID_Type_Hotel = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-type-hotel/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM TypeHotel
            WHERE   ID_Type_Hotel = ${id}
            AND     ID_Type_Hotel NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});




app.get('/admin-type-room', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT ID_Type_Room, NameTR FROM TypeRoom';
    if (search) {
        query += ` WHERE NameTR LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-type-room', async (req, res) => {
    const { NameTR } = req.body;

    if (!NameTR) {
        return res.status(400).send('Please provide NameTR');
    }

    try {
        await sql.query`
            INSERT INTO TypeRoom (NameTR)
            VALUES (${NameTR})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-type-room/:id', async (req, res) => {
    const { id } = req.params;
    const { NameTR } = req.body;

    if (!NameTR) {
        return res.status(400).send('Please provide NameTR');
    }

    try {
        await sql.query`
            UPDATE  TypeRoom
            SET     NameTR = ${NameTR}
            WHERE   ID_Type_Room = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-type-room/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM TypeRoom
            WHERE   ID_Type_Room = ${id}
            AND     ID_Type_Room NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});



app.get('/admin-type-view', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT ID_Type_Room, NameTV FROM TypeView';
    if (search) {
        query += ` WHERE NameTV LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-type-view', async (req, res) => {
    const { NameTV } = req.body;

    if (!NameTV) {
        return res.status(400).send('Please provide NameTV');
    }

    try {
        await sql.query`
            INSERT INTO TypeView (NameTV)
            VALUES (${NameTV})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-type-view/:id', async (req, res) => {
    const { id } = req.params;
    const { NameTV } = req.body;

    if (!NameTV) {
        return res.status(400).send('Please provide NameTV');
    }

    try {
        await sql.query`
            UPDATE  TypeView
            SET     NameTV = ${NameTV}
            WHERE   ID_Type_Room = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-type-view/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM TypeView
            WHERE   ID_Type_Room = ${id}
            AND     ID_Type_Room NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});



app.get('/admin-offer-status', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT ID_Offer_Status, NameOS FROM OfferStatus';
    if (search) {
        query += ` WHERE NameOS LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

// เพิ่มข้อมูล
app.post('/admin-offer-status', async (req, res) => {
    const { NameOS } = req.body;

    if (!NameOS) {
        return res.status(400).send('Please provide NameOS');
    }

    try {
        await sql.query`
            INSERT INTO OfferStatus (NameOS)
            VALUES (${NameOS})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-offer-status/:id', async (req, res) => {
    const { id } = req.params;
    const { NameOS } = req.body;

    if (!NameOS) {
        return res.status(400).send('Please provide NameOS');
    }

    try {
        await sql.query`
            UPDATE OfferStatus
            SET NameOS = ${NameOS}
            WHERE ID_Offer_Status = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-offer-status/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM OfferStatus
            WHERE   ID_Offer_Status = ${id}
            AND     ID_Offer_Status NOT IN (1, 2, 3);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/detail-room', async (req, res) => {
    const { ID_hotel } = req.query;

    if (!ID_hotel) {
        return res.status(400).send('Please provide an ID_hotel');
    }

    try {
        const result = await sql.query`
            SELECT		RoomHotel.ID_room, NameTR, NameTV, NameRS, PriceH, Deal_Status, NRoom
                        
            FROM		Hotels
            LEFT JOIN	RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
            LEFT JOIN	TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
            LEFT JOIN	TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
            LEFT JOIN   RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
            LEFT JOIN	HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
            LEFT JOIN	Deals			ON HotelDeals.HDID			= Deals.HDID
            LEFT JOIN	IncidentStatus	ON Deals.StatusD			= IncidentStatus.ISID
            WHERE       RoomHotel.ID_hotel  =  ${ID_hotel}
            GROUP BY	RoomHotel.ID_room,NameTR, NameTV, NameRS, PriceH, Deal_Status,  NRoom
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching room details:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/view-images', async (req, res) => {
    const { ID_room } = req.query;

    if (!ID_room) {
        return res.status(400).send('Please provide an ID_room');
    }

    try {
        const result = await sql.query`
            SELECT      ID_room, Img_Url_room
            FROM        RoomlPicture
            WHERE       ID_room = ${ID_room}
            GROUP BY    ID_room, Img_Url_room
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching room images:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/select-room/:ID_hotel', async (req, res) => {
    const ID_hotel = req.params.ID_hotel;
    try {
      // Query ข้อมูลจาก Concerts และ ConcertDeals
    const result = await sql.query`
        select  ID_room ,NameTR , NameTV
        from	RoomHotel
        JOIN	TypeRoom	ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
        JOIN	TypeView	ON RoomHotel.Type_view = TypeView.ID_Type_Room
        WHERE	ID_hotel = ${ID_hotel}
    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});


app.delete('/deleteroom', async (req, res) => {
    const { ID_room } = req.body;

    if (!ID_room) {
        return res.status(400).send('ID_room is required.');
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();

        // Step 1: Check for any active deals with the room
        const checkRequest = new sql.Request(transaction);
        const checkResult = await checkRequest.input('ID_room', sql.Int, ID_room)
            .query(`
                SELECT      Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster,
                            Packeage.ID_deals, Hotels.ID_hotel, Concerts.CID
                FROM        Packeage
                JOIN        Deals           ON Packeage.ID_deals    = Deals.ID_deals
                JOIN        HotelDeals      ON Deals.HDID           = HotelDeals.HDID
                JOIN        RoomHotel       ON HotelDeals.ID_room   = RoomHotel.ID_room
                JOIN        Hotels          ON RoomHotel.ID_hotel   = Hotels.ID_hotel
                JOIN        ConcertDeals    ON Deals.CDID           = ConcertDeals.CDID
                JOIN        Concerts        ON ConcertDeals.CID     = Concerts.CID
                JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
                WHERE       RoomHotel.ID_room = @ID_room
                AND         Deals.StatusD = 2
                GROUP BY    Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, 
                            Packeage.ID_deals, Hotels.ID_hotel, Concerts.CID
            `);

        // If there are active deals, prevent the deletion
        if (checkResult.recordset.length > 0) {
            return res.status(400).send('Cannot delete room. Active deals are associated with this room.');
        }

        // Step 2: Proceed with the deletion if no active deals
        const request1 = new sql.Request(transaction);
        await request1.input('ID_room', sql.Int, ID_room)
            .query(`
                    DELETE FROM RoomlPicture WHERE ID_room = @ID_room
                    DELETE FROM HotelDeals WHERE ID_room = @ID_room
                    
                `);

        const request2 = new sql.Request(transaction);
        await request2.input('ID_room', sql.Int, ID_room)
            .query('DELETE FROM RoomHotel WHERE ID_room = @ID_room');

        await transaction.commit();
        res.status(200).send('Room and associated pictures deleted successfully.');
    } catch (err) {
        await transaction.rollback();
        console.error('Error deleting room and associated pictures:', err.message, err.stack);
        res.status(500).send('Internal server error.');
    }
});



app.get('/province', async (req, res) => {
    let query = 'SELECT * FROM Province';
    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});



app.post(`/cancellation-request/:ID_user/:hotelIDUser/:concertIDUser/:ID_deals/:HDID/:CDID`, async (req, res) => {
    const { ID_user, hotelIDUser, concertIDUser, ID_deals, HDID, CDID } = req.params;

    try {
        const pool = await poolPromise;

        // ตรวจสอบว่า hotelIDUser และ concertIDUser ไม่เท่ากัน
        if (hotelIDUser != concertIDUser) {
            if (hotelIDUser == ID_user) {
                const result = await pool.request()
                    .input('ID_deals', sql.Int, ID_deals)
                    .query(`
                        UPDATE Deals 
                        SET StatusD = 3 
                        WHERE ID_deals = @ID_deals;
                    
                    `);
                console.log('Hotel Status Update Result:', result);

                const result2 = await pool.request()
                .input('HDID', sql.Int, HDID)
                .query(`
                
                    UPDATE HotelSendDeals 
                    SET StatusHD = 3 
                    WHERE HDID = @HDID;

                    UPDATE HotelDeals 
                    SET StatusHD = 3 
                    WHERE HDID = @HDID;

                `);
                console.log('Hotel Status Update Result:', result2);

                // const result3 = await pool.request()
                // .input('CDID', sql.Int, CDID)
                // .query(`
                
                //     UPDATE ConcertSendDeals 
                //     SET StatusCD = 3 
                //     WHERE CDID = @CDID;
                // `);
                // console.log('Hotel Status Update Result:', result3);
            }

            if (concertIDUser == ID_user) {
                const result = await pool.request()
                    .input('ID_deals', sql.Int, ID_deals)
                    .input('CDID', sql.Int, CDID)
                    .query(`
                        UPDATE Deals 
                        SET StatusD = 3 
                        WHERE ID_deals = @ID_deals;
                    `);
                console.log('Concert Status Update Result:', result);


                const resultB = await pool.request()
                    .input('CDID', sql.Int, CDID)
                    .query(`
                    
                        UPDATE ConcertDeals 
                        SET StatusCD = 3 
                        WHERE CDID = @CDID;
                    `);
                console.log('Concert Status Update Result:', resultB);
            }
        } else {
            // การลบข้อมูลและอัปเดตสถานะใน Deals, HotelDeals, ConcertDeals
            if (ID_deals && HDID && CDID) {
                // Fetch detailed concert information
                const concertDetails = await pool.request()
                    .input('CDID', sql.Int, CDID)
                    .query(`
                        SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                                    Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                        FROM		Concerts 
                        JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                        JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                        JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                        JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                        JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                        JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                        LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                        WHERE		ConcertDeals.CDID = @CDID
                    `);
            
                // Fetch hotel and room details
                const hotelDetails = await pool.request()
                    .input('HDID', sql.Int, HDID)
                    .query(`
                        SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                        (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                        (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD, NumOfRooms
                        FROM			HotelPicture
                        JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                        JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                        JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                        JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                        JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                        JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                        LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                        WHERE			HotelDeals.HDID = @HDID
                        GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
                    `);

                const CurrentTime = await pool.request().query(`SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') AS DateAction`)
            
                // Insert data into UserHistory
                await pool.request()
                    .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
                    .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
                    .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
                    .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
                    .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
                    .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
                    .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
                    .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
                    .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
                    .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
                    .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
                    .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
                    .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
                    .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
                    .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
                    .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
                    .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
                    .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
                    .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
                    .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
                    .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
                    .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
                    .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
                    .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
                    .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
                    .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
                    .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
                    .input('NumOfRooms',        sql.Int,     hotelDetails.recordset[0].NumOfRooms)
                    .input('DateAction',        sql.Date,    CurrentTime.recordset[0].DateAction)
                    .query(`
                        INSERT INTO UserHistory (
                            ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                            ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                            E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
                        )
                        VALUES (
                            @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                            @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 2, @ID_user_Hotel,
                            @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                            @NumOfRooms, 2, @DateAction
                        );
                    `);
                const result = await pool.request()
                .input('ID_deals', sql.Int, ID_deals)
                .input('HDID', sql.Int, HDID)
                .input('CDID', sql.Int, CDID)
                .query(`
                    DELETE FROM Packeage                 WHERE ID_deals = @ID_deals;
                    DELETE FROM Deals                    WHERE ID_deals = @ID_deals;
                    DELETE FROM HotelSendDeals           WHERE HDID     = @HDID;
                    UPDATE ConcertDeals SET StatusCD = 1 WHERE CDID     = @CDID;
                `);
            }
            
        }

        // Query ข้อมูลใหม่หลังจากอัปเดตหรือยกเลิก
        const newResult1 = await pool.request()
            .input('ID_user', sql.Int, ID_user)
            .query(/* query เดิมสำหรับ Concerts.ID_user */);

        const newResult2 = await pool.request()
            .input('ID_user', sql.Int, ID_user)
            .query(/* query เดิมสำหรับ Hotels.ID_user */);

        res.json({
            message: 'Cancellation request processed successfully',
            matchingByUser: newResult1.recordset,
            matchingByOther: newResult2.recordset
        });

    } catch (err) {
        console.error('Error processing cancellation:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error', details: err.message });
        }
    }
});



app.get('/cancel-concert-offers', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        const result = await sql.query`
            SELECT  *
            FROM    Deals
            JOIN    HotelDeals      ON Deals.HDID           = HotelDeals.HDID
            JOIN    RoomHotel       ON HotelDeals.ID_room   = RoomHotel.ID_room
            JOIN    Hotels          ON RoomHotel.ID_hotel   = Hotels.ID_hotel
            JOIN    ConcertDeals    ON Deals.CDID           = ConcertDeals.CDID
            JOIN    Concerts        ON ConcertDeals.CID     = Concerts.CID
            WHERE   Deals.StatusD       = 2
            AND     HotelDeals.StatusHD = 2
            AND     Hotels.ID_user      = ${ID_user}
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching concert offers:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/cancel-hotel', async (req, res) => {
    const { HDID, ID_deals } = req.body;

    if (!HDID || !ID_deals) {
        return res.status(400).json({ message: 'Please provide all required fields: HDID and ID_deals' });
    }

    let transaction;

    try {
        // เริ่ม transaction ใหม่
        const pool = await poolPromise; // ใช้ connection pool
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        // Step 1: Fetch CDID จาก Deals
        const cdidRequest = new sql.Request(transaction);
        const cdidResult = await cdidRequest.input('ID_deals', sql.Int, ID_deals).query(`
            SELECT CDID FROM Deals WHERE ID_deals = @ID_deals
        `);

        if (cdidResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'No CDID found for the given deal' });
        }

        const { CDID } = cdidResult.recordset[0];

        // Step 2: Update ConcertDeals
        await new sql.Request(transaction).input('CDID', sql.Int, CDID).query(`
            UPDATE ConcertDeals SET StatusCD = 1 WHERE CDID = @CDID
        `);

        // Step 3: Delete ข้อมูลจาก Packages ก่อนลบจาก Deals
        await new sql.Request(transaction).input('ID_deals', sql.Int, ID_deals).query(`
            DELETE FROM Packeage WHERE ID_deals = @ID_deals;
        `);

        // Step 4: ลบจาก Deals
        await new sql.Request(transaction).input('ID_deals', sql.Int, ID_deals).query(`
            DELETE FROM Deals WHERE ID_deals = @ID_deals;
        `);

        // Step 5: Update HotelSendDeals
        await new sql.Request(transaction).input('HDID', sql.Int, HDID).query(`
            UPDATE HotelSendDeals SET StatusHD = 1 WHERE HDID = @HDID
        `);

        // Step 6: Delete HotelSendDeals
        await new sql.Request(transaction).input('HDID', sql.Int, HDID).query(`
            DELETE FROM HotelSendDeals WHERE HDID = @HDID;
        `);

        // Commit transaction เมื่อทุกอย่างสำเร็จ
        await transaction.commit();
        res.status(200).json({ message: 'Concert offer cancelled, package deleted, and hotel deal updated successfully' });
    } catch (err) {
        // หากเกิดข้อผิดพลาดในระหว่างการทำ transaction ให้ rollback
        if (transaction) {
            try {
                await transaction.rollback();
                res.status(500).json({ message: 'Transaction error, rolled back successfully', error: err.message || 'Unknown error occurred' });
            } catch (rollbackError) {
                // กรณี rollback ล้มเหลว
                res.status(500).json({ message: 'Transaction rollback failed', error: rollbackError.message || 'Unknown error occurred' });
            }
        } else {
            res.status(500).json({ message: 'Transaction failed to start', error: err.message || 'Unknown error occurred' });
        }
    }
});


app.post('/confirm-cancel-concert', async (req, res) => {
    const { CDID, ID_deals, HDID } = req.body;

    if (!CDID || !ID_deals || !HDID ) {
        return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน: HDID, ID_deals, CDID, และ Number_of_room' });
    }

    let transaction;

    try {
        const pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();


        const concertDetails = await pool.request()
            .input('CDID', sql.Int, CDID)
            .query(`
                SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                FROM		Concerts 
                JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                WHERE		ConcertDeals.CDID = @CDID
        `);


        const hotelDetails = await pool.request()
            .input('HDID', sql.Int, HDID)
            .query(`
                SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD, NumOfRooms
                FROM			HotelPicture
                JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                WHERE			HotelDeals.HDID = @HDID
                GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
        `);

        const CurrentTime = await pool.request().query(`SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') AS DateAction`)
            
        // Insert data into UserHistory
        await pool.request()
            .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
            .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
            .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
            .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
            .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
            .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
            .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
            .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
            .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
            .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
            .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
            .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
            .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
            .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
            .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
            .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
            .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
            .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
            .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
            .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
            .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
            .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
            .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
            .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
            .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
            .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
            .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
            .input('NumOfRooms',        sql.Int,     hotelDetails.recordset[0].NumOfRooms)
            .input('DateAction',        sql.Date,    CurrentTime.recordset[0].DateAction)
            .query(`
                INSERT INTO UserHistory (
                    ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                    Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                    ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                    E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
                )
                VALUES (
                    @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                    @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 9, @ID_user_Hotel,
                    @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                    @NumOfRooms, 10, @DateAction
                );
        `);


        // ลบข้อมูลจาก Packages
        await new sql.Request(transaction)
            .input('ID_deals', sql.Int, ID_deals)
            .query(`DELETE FROM Packeage WHERE ID_deals = @ID_deals;`);

        // ลบจาก Deals
        await new sql.Request(transaction)
            .input('ID_deals', sql.Int, ID_deals)
            .query(`DELETE FROM Deals WHERE ID_deals = @ID_deals;`);

        // อัปเดตสถานะใน ConcertDeals
        await new sql.Request(transaction)
            .input('CDID', sql.Int, CDID)
            .query(`UPDATE ConcertDeals SET StatusCD = 1 WHERE CDID = @CDID`);

        // ตรวจสอบและอัปเดตจำนวนห้องใน HotelSendDeals
        const hotelDealsRequest = new sql.Request(transaction);
        const hotelDealsResult = await hotelDealsRequest
            .input('HDID', sql.Int, HDID)
            .query(`SELECT NumOfRooms FROM HotelSendDeals WHERE HDID = @HDID`);

        await hotelDealsRequest
            .query(`
                    DELETE FROM HotelSendDeals WHERE HDID = @HDID
                    DELETE FROM HotelDeals WHERE HDID = @HDID
                `);

        // ลบ ConcertSendDeals
        await new sql.Request(transaction)
            .input('CDID', sql.Int, CDID)
            .query(`DELETE FROM ConcertSendDeals WHERE CDID = @CDID`);

        // Commit transaction
        await transaction.commit();
        res.status(200).json({ message: 'ยกเลิกการจองคอนเสิร์ตเรียบร้อยแล้ว' });
    } catch (err) {
        if (transaction) {
            try {
                await transaction.rollback();
                res.status(500).json({ message: 'เกิดข้อผิดพลาดในการทำรายการ, rollback สำเร็จ', error: err.message });
            } catch (rollbackError) {
                res.status(500).json({ message: 'การ rollback ล้มเหลว', error: rollbackError.message });
            }
        } else {
            res.status(500).json({ message: 'ไม่สามารถเริ่มต้น transaction ได้', error: err.message });
        }
    }
});



app.get('/count-cancel-concert-offers', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        const result = await sql.query`
            SELECT  COUNT(*) as offerCount_cancel_concert
            FROM    Deals
            JOIN    HotelDeals      ON Deals.HDID           = HotelDeals.HDID
            JOIN    RoomHotel       ON HotelDeals.ID_room   = RoomHotel.ID_room
            JOIN    Hotels          ON RoomHotel.ID_hotel   = Hotels.ID_hotel
            JOIN    ConcertDeals    ON Deals.CDID           = ConcertDeals.CDID
            JOIN    Concerts        ON ConcertDeals.CID     = Concerts.CID
            WHERE   Deals.StatusD			= 3
            AND     ConcertDeals.StatusCD	= 3
            AND     Hotels.ID_user			= ${ID_user}
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching concert offers:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/count-cancel-hotel-offers', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        const result = await sql.query`
            WITH	RankedDeals AS 
                    (
                    SELECT		HotelDeals.HDID, NameH, RoomHotel.ID_room, ConcertDeals.CDID, 
                                RoomlPicture.Img_Url_room AS MinImg_Url_Hotel, NameTH, NameTR, Number_of_room, PriceH,
                                RoomHotel.ID_hotel, NameTV, Deals.ID_deals,Name, Number_of_ticket, PriceCD, Poster, Concerts.CID, 
                                Con_NumOfRooms, NumOfRooms,
                                CASE 
                                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                                        WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                                    END + ' ' +
                                    FORMAT(CONVERT(datetime, S_datetimeHD), 'dd', 'th-TH') + ' ' +
                                    CASE 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 1 THEN 'มกราคม' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 2 THEN 'กุมภาพันธ์' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 3 THEN 'มีนาคม' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 4 THEN 'เมษายน' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 5 THEN 'พฤษภาคม' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 6 THEN 'มิถุนายน' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 7 THEN 'กรกฎาคม' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 8 THEN 'สิงหาคม' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 9 THEN 'กันยายน' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 10 THEN 'ตุลาคม' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 11 THEN 'พฤศจิกายน' 
                                        WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 12 THEN 'ธันวาคม' 
                                    END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetimeHD)) + 543 AS NVARCHAR) AS S_datetimeHD_TH, 

                                    CASE 
                                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                                        WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                                    END + ' ' +
                                    FORMAT(CONVERT(datetime, E_datetimeHD), 'dd', 'th-TH') + ' ' +
                                    CASE 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 1 THEN 'มกราคม' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 2 THEN 'กุมภาพันธ์' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 3 THEN 'มีนาคม' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 4 THEN 'เมษายน' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 5 THEN 'พฤษภาคม' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 6 THEN 'มิถุนายน' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 7 THEN 'กรกฎาคม' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 8 THEN 'สิงหาคม' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 9 THEN 'กันยายน' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 10 THEN 'ตุลาคม' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 11 THEN 'พฤศจิกายน' 
                                        WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 12 THEN 'ธันวาคม' 
                                    END + ' ' + CAST(YEAR(CONVERT(datetime, E_datetimeHD)) + 543 AS NVARCHAR) AS E_datetimeHD_TH,
                                ROW_NUMBER() OVER 
                                    (
                                        PARTITION BY	HotelDeals.HDID, RoomHotel.ID_room 
                                        ORDER BY		RoomlPicture.Img_Url_room
                                    ) 
                                AS rn
                    FROM		Deals
                    LEFT JOIN	HotelDeals			ON Deals.HDID			= HotelDeals.HDID
                    LEFT JOIN	RoomHotel			ON HotelDeals.ID_room	= RoomHotel.ID_room
                    LEFT JOIN	Hotels				ON RoomHotel.ID_hotel	= Hotels.ID_hotel
                    LEFT JOIN	TypeHotel			ON Hotels.Type_hotel	= TypeHotel.ID_Type_Hotel
                    LEFT JOIN	TypeView			ON RoomHotel.Type_view	= TypeView.ID_Type_Room
                    LEFT JOIN	TypeRoom			ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
                    LEFT JOIN	RoomlPicture		ON RoomHotel.ID_room	= RoomlPicture.ID_room
                    LEFT JOIN	ConcertDeals		ON Deals.CDID			= ConcertDeals.CDID
                    LEFT JOIN	Concerts			ON ConcertDeals.CID		= Concerts.CID
                    LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                    LEFT JOIN	HotelSendDeals		ON HotelDeals.HDID		= HotelSendDeals.HDID
                    WHERE		Deals.StatusD = 3
                    AND			(HotelSendDeals.StatusHD = 3		OR HotelSendDeals.HDID IS NULL)
                    AND			(Concerts.ID_user = ${ID_user}	OR Concerts.ID_user IS NULL)
                                                                            
                    )
                    SELECT	COUNT(*) AS offerCountHotel
                    FROM	RankedDeals
                    WHERE	rn = 1
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching hotel offers:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/cancel-concert', async (req, res) => {
    const { CDID, ID_deals } = req.body;

    if (!CDID || !ID_deals) {
        return res.status(400).send('Please provide both HDID and ID_deals');
    }

    const CDIDValue = Array.isArray(CDID) ? CDID[0] : CDID;
    const ID_dealsValue = Array.isArray(ID_deals) ? ID_deals[0] : ID_deals;

    // ตรวจสอบค่าที่รับมาว่าถูกต้องหรือไม่
    if (typeof ID_dealsValue !== 'string') {
        return res.status(400).send('Invalid ID_deals value');
    }

    try {
        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input('CDID', sql.VarChar, CDIDValue);
        request.input('ID_deals', sql.VarChar, ID_dealsValue);

        const updateResult = await request.query(`
            UPDATE ConcertDeals
            SET StatusCD = 2
            WHERE CDID = @CDID
        `);

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Hotel offer not found');
        }

        const UpdateDealsResult = await request.query(`
            UPDATE Deals
            SET StatusD = 2
            WHERE ID_deals = @ID_deals
        `);

        if (UpdateDealsResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Deal not found');
        }

        await transaction.commit();
        res.status(200).send('Hotel offer cancelled and deal deleted successfully');
    } catch (err) {
        console.error('Error cancelling hotel offer and deleting deal:', err); 
        res.status(500).send('Internal server error');
    }
});

app.post('/cancel-hotel-main', async (req, res) => {
    const { HDID, CDID, ID_deals } = req.body;

    // ตรวจสอบว่ามีค่าที่จำเป็นหรือไม่
    if (!HDID || !CDID || !ID_deals) {
        return res.status(400).send('Please provide HDID, CDID, and ID_deals');
    }

    // ตรวจสอบว่า HDID, CDID และ ID_deals เป็น array หรือไม่และดึงค่าแรกออกมา
    const HDIDValue = Array.isArray(HDID) ? HDID[0] : HDID;
    const CDIDValue = Array.isArray(CDID) ? CDID[0] : CDID;
    const ID_dealsValue = Array.isArray(ID_deals) ? ID_deals[0] : ID_deals;

    // ตรวจสอบว่าค่า ID_deals เป็น string หรือไม่
    if (typeof ID_dealsValue !== 'string') {
        return res.status(400).send('Invalid ID_deals value');
    }

    try {
        // เชื่อมต่อฐานข้อมูล
        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
    
        // Query ค้นหารายละเอียดคอนเสิร์ต
        const requestConcert = new sql.Request(transaction);
        const concertDetails = await requestConcert
            .input('CDID', sql.Int, CDIDValue)
            .query(`
                SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                FROM		Concerts 
                JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                WHERE		ConcertDeals.CDID = @CDID
            `);
    
        // Query ค้นหารายละเอียดโรงแรม
        const requestHotel = new sql.Request(transaction);
        const hotelDetails = await requestHotel
            .input('HDID', sql.Int, HDIDValue)
            .query(`
                SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD, NumOfRooms
                FROM			HotelPicture
                JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                WHERE			HotelDeals.HDID = @HDID
                GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
            `);
    
        // ดึงวันที่และเวลาปัจจุบัน
        const requestTime = new sql.Request(transaction);
        const currentTime = await requestTime.query(`SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') AS DateAction`);
    
        // เพิ่มข้อมูลลงในตาราง UserHistory
        const requestHistory = new sql.Request(transaction);
        await requestHistory
        .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
        .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
        .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
        .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
        .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
        .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
        .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
        .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
        .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
        .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
        .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
        .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
        .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
        .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
        .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
        .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
        .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
        .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
        .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
        .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
        .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
        .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
        .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
        .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
        .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
        .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
        .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
        .input('NumOfRooms',        sql.Int,     hotelDetails.recordset[0].NumOfRooms)
        .input('DateAction',        sql.Date,    currentTime.recordset[0].DateAction)
        .query(`
            INSERT INTO UserHistory (
                ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction
            )
            VALUES (
                @ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 14, @ID_user_Hotel,
                @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                @NumOfRooms, 7, @DateAction
            );
        `);
    
        // อัปเดตสถานะข้อเสนอของโรงแรม
        const requestUpdateHotel = new sql.Request(transaction);
        const updateResult = await requestUpdateHotel
            .input('HDID', sql.Int, HDIDValue)
            .query(`UPDATE HotelSendDeals SET StatusHD = 2 WHERE HDID = @HDID`);
    
            if (updateResult.rowsAffected[0] === 0) {
                // หากไม่สำเร็จ ให้ลองอัปเดตที่ HotelDeals แทน
                const requestUpdateHotelDeals = new sql.Request(transaction);
                const fallbackResult = await requestUpdateHotelDeals
                    .input('HDID', sql.Int, HDIDValue)
                    .query(`UPDATE HotelDeals SET StatusHD = 2 WHERE HDID = @HDID`);
        
                if (fallbackResult.rowsAffected[0] === 0) {
                    // หากไม่พบข้อเสนอในทั้งสองตาราง ให้ยกเลิกการทำงาน
                    await transaction.rollback();
                    return res.status(404).send('Hotel offer not found');
                }
            }
    
        // อัปเดตสถานะของ Deals
        const requestUpdateDeals = new sql.Request(transaction);
        const UpdateDealsResult = await requestUpdateDeals
            .input('ID_deals', sql.VarChar, ID_dealsValue)
            .query(`UPDATE Deals SET StatusD = 2 WHERE ID_deals = @ID_deals`);
    
        if (UpdateDealsResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Deal not found');
        }
    
        await transaction.commit();
        res.status(200).send('Hotel offer cancelled and deal deleted successfully');
    } catch (err) {
        console.error('Error cancelling hotel offer and deleting deal:', err); 
        res.status(500).send('Internal server error');
    }
});



app.get('/concertdeals-c', async (req, res) => {
    const { CID } = req.query;

    // ตรวจสอบข้อมูล
    if (!CID || isNaN(CID)) {
        return res.status(400).send('Valid CID is required.');
    }

    try {
        const request = new sql.Request();

        // ตั้งค่าพารามิเตอร์สำหรับคำสั่ง SQL
        request.input('CID', sql.Int, CID);

        // คำสั่ง SQL เพื่อดึงข้อมูลจากตาราง ShowTime
        const query = `
            SELECT  Show_secheduld, Poster, Name, LineUP, Address, NameTS, NameTC, Time, NameT, Ticket_zone, Price,StartDate, EndDate,
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
            FROM    Concerts
            JOIN    ShowTime    ON Concerts.CID       = ShowTime.CID
            JOIN    TicketInform ON Concerts.CID      = TicketInform.CID
            JOIN    TypeTicket   ON TicketInform.Type = TypeTicket.TID
            JOIN    TypeConcert  ON Concerts.Con_type = TypeConcert.ID_Type_Con
            JOIN    TypeShow     ON Concerts.Per_type = TypeShow.ID_Type_Show
            WHERE   Concerts.CID = @CID
        `;

        // รันคำสั่ง SQL โดยใช้ await
        const result = await request.query(query);

        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).send('No data found for the provided CID.');
        }

    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
    }
});
app.get('/concertsU-MAX', async (req, res) => {
    const { id_user, search } = req.query;

    let query = `
        SELECT  DISTINCT Poster, Name, Address, Concerts.CID, NameTC, NameTS, NameT, Deal_Status, 
                CASE 
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                    WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                    WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                    WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                CASE 
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                    WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                    WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                    WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

                StartDate  
        FROM        Concerts
        JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_Con
        JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
        JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
        JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
        JOIN        TypeTicket      ON TicketInform.Type    = TypeTicket.TID
        LEFT JOIN   ConcertDeals    ON Concerts.CID         = ConcertDeals.CID
        LEFT JOIN   Deals           ON ConcertDeals.CDID    = Deals.CDID
        LEFT JOIN   IncidentStatus  ON Deals.StatusD        = IncidentStatus.ISID
        WHERE       Concerts.ID_user = @id_user
    `;

    const inputs = [{ name: 'id_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name        LIKE @search OR
                Address     LIKE @search OR
                NameTC      LIKE @search OR
                NameTS      LIKE @search OR
                Price       LIKE @search OR
                NameT       LIKE @search OR
                Deal_Status LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += ` ORDER BY StartDate DESC`;
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/concertsU-MIN', async (req, res) => {
    const { id_user, search } = req.query;

    let query = `
        SELECT  DISTINCT Poster, Name, Address, Concerts.CID, NameTC, NameTS, NameT, Deal_Status, 
                CASE 
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                    WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                    WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                    WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                CASE 
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                    WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                    WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                    WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

                StartDate  
        FROM        Concerts
        JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_Con
        JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
        JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
        JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
        JOIN        TypeTicket      ON TicketInform.Type    = TypeTicket.TID
        LEFT JOIN   ConcertDeals    ON Concerts.CID         = ConcertDeals.CID
        LEFT JOIN   Deals           ON ConcertDeals.CDID    = Deals.CDID
        LEFT JOIN   IncidentStatus  ON Deals.StatusD        = IncidentStatus.ISID
        WHERE       Concerts.ID_user = @id_user
    `;

    const inputs = [{ name: 'id_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name        LIKE @search OR
                Address     LIKE @search OR
                NameTC      LIKE @search OR
                NameTS      LIKE @search OR
                Price       LIKE @search OR
                NameT       LIKE @search OR
                Deal_Status LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += ` ORDER BY StartDate ASC`;
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});
app.get('/editseehodeals', async (req, res) => {
    const { HDID } = req.query;

    if (!HDID) {
        return res.status(400).send('HDID parameter is required');
    }

    try {
        const result = await sql.query`
            SELECT	NameH, RoomHotel.ID_room, NameTR, NameTV, NameRS, Number_of_room, S_datetimeHD, E_datetimeHD, NameOS, HDID, Total
            FROM	Hotels 
            JOIN	RoomHotel	ON Hotels.ID_hotel = RoomHotel.ID_hotel
            JOIN	TypeRoom	ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
            JOIN	TypeView	ON RoomHotel.Type_view = TypeView.ID_Type_Room 
            JOIN	RoomStatus	ON RoomHotel.Status_room = RoomStatus.ID_Room_Status
            JOIN	HotelDeals	ON RoomHotel.ID_room = HotelDeals.ID_room
            JOIN	OfferStatus	ON HotelDeals.StatusHD = OfferStatus.ID_Offer_Status
            WHERE	HotelDeals.HDID = ${HDID}
            AND		OfferStatus.ID_Offer_Status = 1
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});


app.post('/confirm-hotel-offer-main', async (req, res) => {
    const { HDID, CDID, ID_deals, Deadline_package, S_Deadline_package } = req.body;

    // Check for required fields
    if (!HDID || !CDID || !ID_deals || !Deadline_package || !S_Deadline_package) {
        return res.status(400).json({ message: 'Please provide all required fields: HDID, CDID, ID_deals, Deadline_package, and S_Deadline_package' });
    }

    try {
        const transaction = new sql.Transaction();
        await transaction.begin();

        try {
            // Query for concert details
            const concertRequest = new sql.Request(transaction);
            const concertDetails = await concertRequest
                .input('CDID', sql.Int, CDID)
                .query(`
                    SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                                Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                    FROM		Concerts 
                    JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                    JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                    JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                    JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                    JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                    JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                    LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                    WHERE		ConcertDeals.CDID = @CDID
                `);

            // Query for hotel details
            const hotelRequest = new sql.Request(transaction);
            const hotelDetails = await hotelRequest
                .input('HDID', sql.Int, HDID)
                .query(`
                    SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                    (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                    (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD, NumOfRooms
                    FROM			HotelPicture
                    JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                    JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                    JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                    JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                    JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                    JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                    LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                    WHERE			HotelDeals.HDID = @HDID
                    GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
                `);

            const currentTime = await new sql.Request(transaction).query(`SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') AS DateAction`);

            // Insert into UserHistory
            await new sql.Request(transaction)
                .input('ID_user_Concert', sql.Int, concertDetails.recordset[0].ID_user_Concert)
                .input('Name', sql.VarChar, concertDetails.recordset[0].Name)
                .input('Show_secheduld', sql.VarChar, concertDetails.recordset[0].Show_secheduld)
                .input('Poster', sql.VarChar, concertDetails.recordset[0].Poster)
                .input('Address', sql.VarChar, concertDetails.recordset[0].Address)
                .input('StartDate', sql.Date, concertDetails.recordset[0].StartDate)
                .input('EndDate', sql.Date, concertDetails.recordset[0].EndDate)
                .input('NameTC', sql.VarChar, concertDetails.recordset[0].NameTC)
                .input('NameTS', sql.VarChar, concertDetails.recordset[0].NameTS)
                .input('NameT', sql.VarChar, concertDetails.recordset[0].NameT)
                .input('Number_of_ticket', sql.Int, concertDetails.recordset[0].Number_of_ticket)
                .input('PriceCD', sql.Int, concertDetails.recordset[0].PriceCD)
                .input('Ticket_zone', sql.VarChar, concertDetails.recordset[0].Ticket_zone)
                .input('Time', sql.VarChar, concertDetails.recordset[0].Time)
                .input('Con_NumOfRooms', sql.Int, concertDetails.recordset[0].Con_NumOfRooms)
                .input('S_datelineCD', sql.Date, concertDetails.recordset[0].S_datelineCD)
                .input('E_datelineCD', sql.Date, concertDetails.recordset[0].E_datelineCD)
                .input('ID_user_Hotel', sql.Int, hotelDetails.recordset[0].ID_user_Hotel)
                .input('Img_Url_Hotel', sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
                .input('Img_Url_room', sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
                .input('NameH', sql.VarChar, hotelDetails.recordset[0].NameH)
                .input('AddressH', sql.VarChar, hotelDetails.recordset[0].AddressH)
                .input('NameTR', sql.VarChar, hotelDetails.recordset[0].NameTR)
                .input('NameTV', sql.VarChar, hotelDetails.recordset[0].NameTV)
                .input('PriecH', sql.Int, hotelDetails.recordset[0].PriecH)
                .input('S_datelineHD', sql.Date, hotelDetails.recordset[0].S_datelineHD)
                .input('E_datelineHD', sql.Date, hotelDetails.recordset[0].E_datelineHD)
                .input('NumOfRooms', sql.Int, hotelDetails.recordset[0].NumOfRooms)
                .input('DateAction', sql.Date, currentTime.recordset[0].DateAction)
                .query(`
                    INSERT INTO UserHistory (ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                                             Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, E_datelineCD, Type_History_Con,
                                             ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, S_datelineHD, 
                                             E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction)
                    VALUES (@ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, @NameTS, @NameT, 
                            @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, @E_datelineCD, 4, @ID_user_Hotel,
                            @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, @PriecH, @S_datelineHD, @E_datelineHD,
                            @NumOfRooms, 3, @DateAction)
                `);

            // Insert into Package
            console.log('Inserting into Package', { ID_deals, Deadline_package, S_Deadline_package });
            await new sql.Request(transaction)
                .input('ID_deals', sql.Int, ID_deals)
                .input('Deadline_package', sql.Date, new Date(Deadline_package))
                .input('S_Deadline_package', sql.Date, new Date(S_Deadline_package))
                .query(`
                    INSERT INTO Packeage (ID_deals, Deadline_package, S_Deadline_package)
                    VALUES (@ID_deals, @Deadline_package, @S_Deadline_package)
                `);

            // Fetch CDID from Deals
            console.log('Fetching CDID for ID_deals:', ID_deals);

            // Update ConcertDeals
            console.log('Updating ConcertDeals status for CDID:', CDID);
            await new sql.Request(transaction)
                .input('CDID', sql.Int, CDID)
                .query(`
                    UPDATE ConcertDeals
                    SET StatusCD = 2
                    WHERE CDID = @CDID

                    UPDATE Deals
                    SET StatusD = 2
                    WHERE CDID = @CDID
                `);

            await transaction.commit();
            res.status(200).json({ message: 'Hotel offer confirmed and concert deal updated successfully' });
        } catch (error) {
            await transaction.rollback();
            console.error(error);
            res.status(500).json({ message: 'Error confirming hotel offer or updating concert deal', error });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error starting transaction', error });
    }
});


app.post('/confirm-cancel-hotel-main', async (req, res) => {
    const { HDID, CDID, ID_deals } = req.body;

    if (!HDID || !CDID || !ID_deals) {
        return res.status(400).json({ message: 'Please provide all required fields: HDID, CDID, and ID_deals' });
    }

    let transaction;

    try {
        const pool = await poolPromise; // ใช้ connection pool
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const concertDetails = await transaction.request() // เปลี่ยนเป็น transaction.request()
            .input('CDID', sql.Int, CDID)
            .query(`
                SELECT		(Concerts.ID_user)AS ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, NameTC, NameTS, NameT, 
                            Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, (S_datetime) AS S_datelineCD ,  (E_datetime) AS E_datelineCD
                FROM		Concerts 
                JOIN		TypeConcert			ON Concerts.Con_type	= ID_Type_Con
                JOIN		ShowTime			ON Concerts.CID			= ShowTime.CID
                JOIN		TypeShow			ON Concerts.Per_type	= ID_Type_Show
                JOIN		TicketInform		ON Concerts.CID			= TicketInform.CID
                JOIN		TypeTicket			ON TicketInform.Type	= TypeTicket.TID
                JOIN		ConcertDeals		ON Concerts.CID			= ConcertDeals.CID
                LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                WHERE		ConcertDeals.CDID = @CDID
        `);

        const hotelDetails = await transaction.request() // เปลี่ยนเป็น transaction.request()
            .input('HDID', sql.Int, HDID)
            .query(`
                SELECT			MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel,  MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                                (Hotels.ID_user)AS ID_user_Hotel, NameH, AddressH, NameTR, NameTV,
                                (PriceH)AS PriecH, (S_datetimeHD)AS S_datelineHD, (E_datetimeHD)AS E_datelineHD, NumOfRooms
                FROM			HotelPicture
                JOIN			RoomHotel		ON HotelPicture.ID_hotel	= RoomHotel.ID_hotel
                JOIN			Hotels			ON RoomHotel.ID_hotel		= Hotels.ID_hotel
                JOIN			RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
                JOIN			TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                JOIN			TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                JOIN			HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                LEFT JOIN		HotelSendDeals	ON HotelDeals.HDID			= HotelSendDeals.HDID
                WHERE			HotelDeals.HDID = @HDID
                GROUP BY		ID_user, NameH, AddressH,NameTR, NameTV, PriceH, S_datetimeHD, E_datetimeHD, NumOfRooms
        `);

        const CurrentTime = await transaction.request().query(`SELECT FORMAT(GETDATE(), 'yyyy-MM HH:mm') AS DateAction`);

        await transaction.request() // เปลี่ยนเป็น transaction.request()
            .input('ID_user_Concert',   sql.Int,     concertDetails.recordset[0].ID_user_Concert)
            .input('Name',              sql.VarChar, concertDetails.recordset[0].Name)
            .input('Show_secheduld',    sql.VarChar, concertDetails.recordset[0].Show_secheduld)
            .input('Poster',            sql.VarChar, concertDetails.recordset[0].Poster)
            .input('Address',           sql.VarChar, concertDetails.recordset[0].Address)
            .input('StartDate',         sql.Date,    concertDetails.recordset[0].StartDate)
            .input('EndDate',           sql.Date,    concertDetails.recordset[0].EndDate)
            .input('NameTC',            sql.VarChar, concertDetails.recordset[0].NameTC)
            .input('NameTS',            sql.VarChar, concertDetails.recordset[0].NameTS)
            .input('NameT',             sql.VarChar, concertDetails.recordset[0].NameT)
            .input('Number_of_ticket',  sql.Int,     concertDetails.recordset[0].Number_of_ticket)
            .input('PriceCD',           sql.Int,     concertDetails.recordset[0].PriceCD)
            .input('Ticket_zone',       sql.VarChar, concertDetails.recordset[0].Ticket_zone)
            .input('Time',              sql.VarChar, concertDetails.recordset[0].Time)
            .input('Con_NumOfRooms',    sql.Int,     concertDetails.recordset[0].Con_NumOfRooms)
            .input('S_datelineCD',      sql.Date,    concertDetails.recordset[0].S_datelineCD)
            .input('E_datelineCD',      sql.Date,    concertDetails.recordset[0].E_datelineCD)
            .input('ID_user_Hotel',     sql.Int,     hotelDetails.recordset[0].ID_user_Hotel)
            .input('Img_Url_Hotel',     sql.VarChar, hotelDetails.recordset[0].Img_Url_Hotel)
            .input('Img_Url_room',      sql.VarChar, hotelDetails.recordset[0].Img_Url_room)
            .input('NameH',             sql.VarChar, hotelDetails.recordset[0].NameH)
            .input('AddressH',          sql.VarChar, hotelDetails.recordset[0].AddressH)
            .input('NameTR',            sql.VarChar, hotelDetails.recordset[0].NameTR)
            .input('NameTV',            sql.VarChar, hotelDetails.recordset[0].NameTV)
            .input('PriecH',            sql.Int,     hotelDetails.recordset[0].PriecH)
            .input('S_datelineHD',      sql.Date,    hotelDetails.recordset[0].S_datelineHD)
            .input('E_datelineHD',      sql.Date,    hotelDetails.recordset[0].E_datelineHD)
            .input('NumOfRooms',        sql.Int,     hotelDetails.recordset[0].NumOfRooms)
            .input('DateAction',        sql.Date,    CurrentTime.recordset[0].DateAction)
            .query(`
                INSERT INTO UserHistory (ID_user_Concert, Name, Show_secheduld, Poster, Address, StartDate, EndDate, 
                NameTC, NameTS, NameT, Number_of_ticket, PriceCD, Ticket_zone, Time, Con_NumOfRooms, S_datelineCD, 
                E_datelineCD, Type_History_Con, ID_user_Hotel, Img_Url_Hotel, Img_Url_room, NameH, AddressH, 
                NameTR, NameTV, PriecH, S_datelineHD, E_datelineHD, NumOfRooms, Type_History_Hotel, DateAction)
                VALUES (@ID_user_Concert, @Name, @Show_secheduld, @Poster, @Address, @StartDate, @EndDate, @NameTC, 
                @NameTS, @NameT, @Number_of_ticket, @PriceCD, @Ticket_zone, @Time, @Con_NumOfRooms, @S_datelineCD, 
                @E_datelineCD, 8, @ID_user_Hotel, @Img_Url_Hotel, @Img_Url_room, @NameH, @AddressH, @NameTR, @NameTV, 
                @PriecH, @S_datelineHD, @E_datelineHD, @NumOfRooms, 7, @DateAction );
        `);

        await transaction.request().input('CDID', sql.Int, CDID).query(` 
                                                                            UPDATE ConcertDeals SET StatusCD = 1 WHERE CDID = @CDID

                                                                            DELETE FROM ConcertSendDeals WHERE CDID = @CDID
                                                                        `);

        await transaction.request().input('ID_deals', sql.Int, ID_deals).query(`DELETE FROM Packeage WHERE ID_deals = @ID_deals`);

        await transaction.request().input('ID_deals', sql.Int, ID_deals).query(`DELETE FROM Deals WHERE ID_deals = @ID_deals`);

        await transaction.request().input('HDID', sql.Int, HDID).query(`DELETE FROM HotelSendDeals WHERE HDID = @HDID`);

        await transaction.request().input('HDID', sql.Int, HDID).query(`DELETE FROM HotelDeals WHERE HDID = @HDID`);


        await transaction.commit();
        res.status(200).json({ message: 'Concert offer cancelled, package deleted, and hotel deal updated successfully' });
    } catch (err) {
        if (transaction) {
            try {
                await transaction.rollback();
                res.status(500).json({ message: 'Transaction error, rolled back successfully', error: err.message });
            } catch (rollbackError) {
                res.status(500).json({ message: 'Transaction rollback failed', error: rollbackError.message });
            }
        } else {
            res.status(500).json({ message: 'Transaction failed to start', error: err.message });
        }
    }
});


app.get('/admin-type-history', async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT * FROM TypeHistory';
    if (search) {
        query += ` WHERE Annotation LIKE '%${search}%'`;
    }

    try {
        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching :', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/admin-type-history', async (req, res) => {
    const { Annotation } = req.body;

    if (!Annotation) {
        return res.status(400).send('Please provide Annotation');
    }

    try {
        await sql.query`
            INSERT INTO TypeHistory (Annotation)
            VALUES (${Annotation})
        `;
        res.status(201).send('added successfully');
    } catch (err) {
        console.error('Error adding  :', err);
        res.status(500).send('Internal server error');
    }
});

// แก้ไขข้อมูล
app.put('/admin-type-history/:id', async (req, res) => {
    const { id } = req.params;
    const { Annotation } = req.body;

    if (!Annotation) {
        return res.status(400).send('Please provide Annotation');
    }

    try {
        await sql.query`
            UPDATE TypeHistory
            SET Annotation = ${Annotation}
            WHERE Type_History = ${id}
        `;
        res.status(200).send(' updated successfully');
    } catch (err) {
        console.error('Error updating :', err);
        res.status(500).send('Internal server error');
    }
});

// ลบข้อมูล
app.delete('/admin-type-history/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await sql.query`
            DELETE  FROM TypeHistory
            WHERE   Type_History = ${id}
            AND     Type_History NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18);
        `;
        res.status(200).send('deleted successfully');
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/all-history-you', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                        WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                        WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                        WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
                ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.get('/all-history-you-MAX', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
        ORDER BY    DateAction DESC

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                CASE 
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                    WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                    WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                    WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
            ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }
    

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/all-history-you-MIN', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									    OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
        ORDER BY    DateAction ASC

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                CASE 
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                    WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                    WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                    WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
            ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` })
    }
    

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/all-history-you-suc', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
        AND			Type_History_Con   IN (1, 4, 5, 2, 9, 12)
        AND			Type_History_Hotel IN (1, 3, 6, 2, 11, 10)

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                        WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                        WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                        WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
                ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.get('/all-history-you-suc-max', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
       

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                        WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                        WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                        WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
                ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += `
            AND Type_History_Con IN (1, 4, 5, 2, 9, 12)
            AND Type_History_Hotel IN (1, 3, 6, 2, 11, 10)
        `;
    }

    query += ` ORDER BY IDHistory DESC`;

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/all-history-you-suc-min', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
        

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                        WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                        WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                        WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
                ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += `
            AND Type_History_Con IN (1, 4, 5, 2, 9, 12)
            AND Type_History_Hotel IN (1, 3, 6, 2, 11, 10)
        `;
    }

    query += ` ORDER BY IDHistory ASC`;

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/all-history-you-failed', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
        AND         Type_History_Con   IN (5, 14, 9, 17)			
        AND			Type_History_Hotel IN (3, 16, 7, 18)

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                        WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                        WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                        WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
                ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/all-history-you-failed-max', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
       

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                        WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                        WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                        WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
                ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += `
            AND         Type_History_Con   IN (5, 14, 9, 17)			
            AND			Type_History_Hotel IN (3, 16, 7, 18)
        `;
    }

    query += ` ORDER BY IDHistory DESC`;

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/all-history-you-failed-min', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	DateFormat AS (
					SELECT 'Monday' AS EnglishDay, 'วันจันทร์' AS ThaiDay UNION ALL
					SELECT 'Tuesday'	, 'วันอังคาร'		UNION ALL
					SELECT 'Wednesday'	, 'วันพุธ'		UNION ALL
					SELECT 'Thursday'	, 'วันพฤหัสบดี'		UNION ALL
					SELECT 'Friday'		, 'วันศุกร์'		UNION ALL
					SELECT 'Saturday'	, 'วันเสาร์'		UNION ALL
					SELECT 'Sunday'		, 'วันอาทิตย์'
				),
				MonthFormat AS (
					SELECT 1 AS MonthNumber, 'มกราคม' AS ThaiMonth UNION ALL
					SELECT 2,  'กุมภาพันธ์'	UNION ALL
					SELECT 3,  'มีนาคม'		UNION ALL
					SELECT 4,  'เมษายน'		UNION ALL
					SELECT 5,  'พฤษภาคม'	UNION ALL
					SELECT 6,  'มิถุนายน'		UNION ALL
					SELECT 7,  'กรกฎาคม'	UNION ALL
					SELECT 8,  'สิงหาคม'		UNION ALL
					SELECT 9,  'กันยายน'		UNION ALL
					SELECT 10, 'ตุลาคม'		UNION ALL
					SELECT 11, 'พฤศจิกายน'	UNION ALL
					SELECT 12, 'ธันวาคม'
				) 
		SELECT		IDHistory,ID_user,
					UserHistory.ID_user_Concert, TH1.Annotation AS ConcertAnnotation,
					Name, Show_secheduld, Poster, Address, NameTC, NameTS, NameT, Number_of_ticket, 
					PriceCD, Ticket_zone, Time, Con_NumOfRooms, Type_History_Con,
			
					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, StartDate) = df.EnglishDay) + ' ' + 
					FORMAT(StartDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(StartDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, EndDate) = df.EnglishDay) + ' ' + 
					FORMAT(EndDate, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(EndDate) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR) AS S_datelineCD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineCD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineCD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR) AS E_datelineCD_TH,

					UserHistory.ID_user_Hotel, TH2.Annotation AS HotelAnnotation,
					Img_Url_Hotel, Img_Url_room, NameH, AddressH, NameTR, NameTV, PriecH, NumOfRooms, Type_History_Hotel,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, S_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(S_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR) AS S_datelineHD_TH,

					(SELECT df.ThaiDay 
					 FROM DateFormat df WHERE DATENAME(WEEKDAY, E_datelineHD) = df.EnglishDay) + ' ' + 
					FORMAT(E_datelineHD, 'dd', 'th-TH') + ' ' + 
					(SELECT mf.ThaiMonth 
					 FROM MonthFormat mf WHERE MONTH(E_datelineHD) = mf.MonthNumber) + ' ' + 
					CAST(YEAR(E_datelineHD) + 543 AS NVARCHAR) AS E_datelineHD_TH,

					(SELECT df.ThaiDay 
                    FROM DateFormat df WHERE DATENAME(WEEKDAY, DateAction) = df.EnglishDay) + ' ' + 
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' + 
                    (SELECT mf.ThaiMonth 
                    FROM MonthFormat mf WHERE MONTH(DateAction) = mf.MonthNumber) + ' ' + 
                    CAST(YEAR(DateAction) + 543 AS NVARCHAR) AS DateAction_TH


		FROM		UserHistory
		JOIN		TypeHistory AS TH1	ON UserHistory.Type_History_Con		= TH1.Type_History
		JOIN		TypeHistory AS TH2	ON UserHistory.Type_History_Hotel	= TH2.Type_History
		JOIN		Users				ON UserHistory.ID_user_Concert		= Users.ID_user 
									OR UserHistory.ID_user_Hotel		= Users.ID_user
		WHERE		ID_user = @ID_user
        

    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name        		LIKE @search OR
                Address     		LIKE @search OR
                NameTC      		LIKE @search OR
                NameTS      		LIKE @search OR
                PriceCD       		LIKE @search OR
                NameT       		LIKE @search OR
                Number_of_ticket 	LIKE @search OR
				
				Ticket_zone       	LIKE @search OR
				Time       			LIKE @search OR
				Con_NumOfRooms      LIKE @search OR
				NameH       		LIKE @search OR
				AddressH       		LIKE @search OR
				NameTR       		LIKE @search OR
				NameTV       		LIKE @search OR
				PriecH       		LIKE @search OR
				NumOfRooms       	LIKE @search OR
                TH1.Annotation      LIKE @search OR
                TH2.Annotation      LIKE @search OR
				
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                            WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                            WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                            WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, E_datelineCD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(E_datelineCD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(E_datelineCD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(E_datelineCD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(E_datelineCD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(E_datelineCD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(E_datelineCD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(E_datelineCD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(E_datelineCD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(E_datelineCD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(E_datelineCD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(E_datelineCD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(E_datelineCD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(E_datelineCD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(E_datelineCD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                        CASE 
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                            WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                        END + ' ' +
                        FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                        CASE 
                            WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                            WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                            WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                            WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                            WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                            WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                            WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                            WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                            WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                            WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                            WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                            WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                        END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                    ) LIKE @search OR
                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, S_datelineHD) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(S_datelineHD, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(S_datelineHD) = 1 THEN 'มกราคม' 
                        WHEN MONTH(S_datelineHD) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(S_datelineHD) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(S_datelineHD) = 4 THEN 'เมษายน' 
                        WHEN MONTH(S_datelineHD) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(S_datelineHD) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(S_datelineHD) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(S_datelineHD) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(S_datelineHD) = 9 THEN 'กันยายน' 
                        WHEN MONTH(S_datelineHD) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(S_datelineHD) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(S_datelineHD) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(S_datelineHD) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, DateAction) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(DateAction, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(DateAction) = 1 THEN 'มกราคม' 
                        WHEN MONTH(DateAction) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(DateAction) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(DateAction) = 4 THEN 'เมษายน' 
                        WHEN MONTH(DateAction) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(DateAction) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(DateAction) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(DateAction) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(DateAction) = 9 THEN 'กันยายน' 
                        WHEN MONTH(DateAction) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(DateAction) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(DateAction) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(DateAction) + 543 AS NVARCHAR)
                ) LIKE @search 
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += `
            AND         Type_History_Con   IN (5, 14, 9, 17)			
            AND			Type_History_Hotel IN (3, 16, 7, 18)
        `;
    }

    query += ` ORDER BY IDHistory ASC`;

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/hotelU-match/:id_user', (req, res) => {
    const { id_user } = req.params;
    const { search } = req.query; // รับค่า search จาก query parameter

    if (!id_user) {
        return res.status(400).send('ID_user is required.');
    }

    let query = `
        WITH HotelDealsInfo AS (
                    SELECT		Hotels.ID_hotel, MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel, 
                                Hotels.NameH, Hotels.AddressH, TypeHotel.NameTH AS NameTH,
                                TypeRoom.NameTR AS NameTR, TypeView.NameTV AS NameTV, RoomStatus.NameRS AS NameRS,
                                MAX(Deal_Status) AS Deal_Status, MAX(Deals.ID_deals) AS ID_deals,
                                ROW_NUMBER() OVER (PARTITION BY Hotels.ID_hotel ORDER BY Deal_Status DESC) AS RowNum
                    FROM		Hotels
                    JOIN		TypeHotel		ON Hotels.Type_hotel		= TypeHotel.ID_Type_Hotel
                    JOIN		HotelPicture	ON Hotels.ID_hotel			= HotelPicture.ID_hotel
                    LEFT JOIN	RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
                    LEFT JOIN	TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                    LEFT JOIN	TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                    LEFT JOIN	RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
                    LEFT JOIN	HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                    LEFT JOIN	Deals			ON HotelDeals.HDID			= Deals.HDID
                    LEFT JOIN	IncidentStatus	ON Deals.StatusD			= IncidentStatus.ISID
                    WHERE		Hotels.ID_user = @ID_user
                    AND         Deals.StatusD  = 2
                    GROUP BY	Hotels.ID_hotel, Hotels.NameH, Hotels.AddressH, TypeHotel.NameTH,
                                TypeRoom.NameTR, TypeView.NameTV, RoomStatus.NameRS, Deal_Status, Deals.ID_deals
        )
        
        SELECT		Img_Url_Hotel, ID_hotel, NameH, AddressH, NameTH, NameTR, NameTV, NameRS, Deal_Status, ID_deals
        FROM		HotelDealsInfo
        WHERE		RowNum = 1
    `;

    const inputs = [
        { name: 'ID_user', type: sql.Int, value: id_user }
    ];

    // เพิ่มเงื่อนไขการค้นหาเมื่อมี search query
    if (search) {
        query += `
            AND (
                    NameH               LIKE @search OR
                    AddressH            LIKE @search OR
                    NameTH              LIKE @search OR
                    NameTR              LIKE @search OR
                    NameTV              LIKE @search OR
                    NameRS              LIKE @search OR
                    Deal_Status         LIKE @search
                )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    query += ` ORDER BY ID_hotel;`;

    executeQuery(query, inputs, (err, result) => {
        if (err) {
            console.error('Get hotels query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(404).send('Hotels not found for this user.');
        }

        res.json(result.recordset);
    });
});


app.get('/hotelU-un-match/:id_user', (req, res) => {
    const { id_user } = req.params;
    const { search } = req.query; // รับค่า search จาก query parameter

    if (!id_user) {
        return res.status(400).send('ID_user is required.');
    }

    let query = `
        WITH HotelDealsInfo AS (
                    SELECT		Hotels.ID_hotel, MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel, 
                                Hotels.NameH, Hotels.AddressH, TypeHotel.NameTH AS NameTH,
                                TypeRoom.NameTR AS NameTR, TypeView.NameTV AS NameTV, RoomStatus.NameRS AS NameRS,
                                MAX(Deal_Status) AS Deal_Status, MAX(Deals.ID_deals) AS ID_deals,
                                ROW_NUMBER() OVER (PARTITION BY Hotels.ID_hotel ORDER BY Deal_Status DESC) AS RowNum
                    FROM		Hotels
                    JOIN		TypeHotel		ON Hotels.Type_hotel		= TypeHotel.ID_Type_Hotel
                    JOIN		HotelPicture	ON Hotels.ID_hotel			= HotelPicture.ID_hotel
                    LEFT JOIN	RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
                    LEFT JOIN	TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
                    LEFT JOIN	TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
                    LEFT JOIN	RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
                    LEFT JOIN	HotelDeals		ON RoomHotel.ID_room		= HotelDeals.ID_room
                    LEFT JOIN	Deals			ON HotelDeals.HDID			= Deals.HDID
                    LEFT JOIN	IncidentStatus	ON Deals.StatusD			= IncidentStatus.ISID
                    WHERE		Hotels.ID_user = @ID_user
                    GROUP BY	Hotels.ID_hotel, Hotels.NameH, Hotels.AddressH, TypeHotel.NameTH,
                                TypeRoom.NameTR, TypeView.NameTV, RoomStatus.NameRS, Deal_Status, Deals.ID_deals
        )
        
        SELECT		Img_Url_Hotel, ID_hotel, NameH, AddressH, NameTH, NameTR, NameTV, NameRS, Deal_Status, ID_deals
        FROM		HotelDealsInfo
        WHERE		RowNum = 1
        AND         ID_deals IS NULL
    `;

    const inputs = [
        { name: 'ID_user', type: sql.Int, value: id_user }
    ];

    // เพิ่มเงื่อนไขการค้นหาเมื่อมี search query
    if (search) {
        query += `
            AND (
                    NameH               LIKE @search OR
                    AddressH            LIKE @search OR
                    NameTH              LIKE @search OR
                    NameTR              LIKE @search OR
                    NameTV              LIKE @search OR
                    NameRS              LIKE @search OR
                    Deal_Status         LIKE @search
                )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    query += ` ORDER BY ID_hotel;`;

    executeQuery(query, inputs, (err, result) => {
        if (err) {
            console.error('Get hotels query error:', err.message, err.code, err);
            return res.status(500).send('Server error. Please try again later.');
        }
        if (result.recordset.length === 0) {
            return res.status(404).send('Hotels not found for this user.');
        }

        res.json(result.recordset);
    });
});


app.get('/concertsU-match', async (req, res) => {
    const { id_user, search } = req.query;

    let query = `
        SELECT  DISTINCT Poster, Name, Address, Concerts.CID, NameTC, NameTS, NameT, Deal_Status, 
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
        FROM        Concerts
        JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_Con
        JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
        JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
        JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
        JOIN        TypeTicket      ON TicketInform.Type    = TypeTicket.TID
        LEFT JOIN   ConcertDeals    ON Concerts.CID         = ConcertDeals.CID
        LEFT JOIN   Deals           ON ConcertDeals.CDID    = Deals.CDID
        LEFT JOIN   IncidentStatus  ON Deals.StatusD        = IncidentStatus.ISID
        WHERE       Concerts.ID_user = @id_user
        AND			Deals.ID_deals IS NOT NULL
    `;

    const inputs = [{ name: 'id_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name        LIKE @search OR
                Address     LIKE @search OR
                NameTC      LIKE @search OR
                NameTS      LIKE @search OR
                Price       LIKE @search OR
                NameT       LIKE @search OR
                Deal_Status LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.get('/concertsU-un-match', async (req, res) => {
    const { id_user, search } = req.query;

    let query = `
        SELECT  DISTINCT Poster, Name, Address, Concerts.CID, NameTC, NameTS, NameT, Deal_Status, 
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
        FROM        Concerts
        JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_Con
        JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
        JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
        JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
        JOIN        TypeTicket      ON TicketInform.Type    = TypeTicket.TID
        LEFT JOIN   ConcertDeals    ON Concerts.CID         = ConcertDeals.CID
        LEFT JOIN   Deals           ON ConcertDeals.CDID    = Deals.CDID
        LEFT JOIN   IncidentStatus  ON Deals.StatusD        = IncidentStatus.ISID
        WHERE       Concerts.ID_user = @id_user
        AND			Deals.ID_deals IS NULL
    `;

    const inputs = [{ name: 'id_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name        LIKE @search OR
                Address     LIKE @search OR
                NameTC      LIKE @search OR
                NameTS      LIKE @search OR
                Price       LIKE @search OR
                NameT       LIKE @search OR
                Deal_Status LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/concertsU-un-match-max', async (req, res) => {
    const { id_user, search } = req.query;

    let query = `
        SELECT  DISTINCT Poster, Name, Address, Concerts.CID, NameTC, NameTS, NameT, Deal_Status, 
                StartDate, -- เพิ่มคอลัมน์ StartDate ตรงนี้เพื่อใช้ในการ ORDER BY
                CASE 
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                    WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                    WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                    WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                CASE 
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                    WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                    WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                    WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
    FROM        Concerts
    JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_Con
    JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
    JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
    JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
    JOIN        TypeTicket      ON TicketInform.Type    = TypeTicket.TID
    LEFT JOIN   ConcertDeals    ON Concerts.CID         = ConcertDeals.CID
    LEFT JOIN   Deals           ON ConcertDeals.CDID    = Deals.CDID
    LEFT JOIN   IncidentStatus  ON Deals.StatusD        = IncidentStatus.ISID
    WHERE       Concerts.ID_user = @id_user
    AND         Deals.ID_deals IS NULL
    `;

    const inputs = [{ name: 'id_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name        LIKE @search OR
                Address     LIKE @search OR
                NameTC      LIKE @search OR
                NameTS      LIKE @search OR
                Price       LIKE @search OR
                NameT       LIKE @search OR
                Deal_Status LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += ` ORDER BY StartDate DESC`;
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});

app.get('/concertsU-un-match-min', async (req, res) => {
    const { id_user, search } = req.query;

    let query = `
        SELECT  DISTINCT Poster, Name, Address, Concerts.CID, NameTC, NameTS, NameT, Deal_Status, 
                    StartDate, -- เพิ่มคอลัมน์ StartDate ตรงนี้เพื่อใช้ในการ ORDER BY
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
        FROM        Concerts
        JOIN        TypeConcert     ON Concerts.Con_type    = TypeConcert.ID_Type_Con
        JOIN        ShowTime        ON Concerts.CID         = ShowTime.CID
        JOIN        TypeShow        ON Concerts.Per_type    = TypeShow.ID_Type_Show
        JOIN        TicketInform    ON Concerts.CID         = TicketInform.CID
        JOIN        TypeTicket      ON TicketInform.Type    = TypeTicket.TID
        LEFT JOIN   ConcertDeals    ON Concerts.CID         = ConcertDeals.CID
        LEFT JOIN   Deals           ON ConcertDeals.CDID    = Deals.CDID
        LEFT JOIN   IncidentStatus  ON Deals.StatusD        = IncidentStatus.ISID
        WHERE       Concerts.ID_user = @id_user
        AND         Deals.ID_deals IS NULL
    `;

    const inputs = [{ name: 'id_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name        LIKE @search OR
                Address     LIKE @search OR
                NameTC      LIKE @search OR
                NameTS      LIKE @search OR
                Price       LIKE @search OR
                NameT       LIKE @search OR
                Deal_Status LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE @search OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } else {
        query += ` ORDER BY StartDate ASC`;
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/packeage-and-search', async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT	Concerts.CID, Poster, Name, NameTC, LineUP, Address, NameT, PriceCD, Time, Ticket_zone,Number_of_ticket, NameTS,
			        Hotels.ID_hotel ,NameH, AddressH, PriceH, NameTH, NameTR, NameTV, NameRS, Number_of_room, Total,
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH
			FROM	Packeage
			JOIN	Deals			ON Packeage.ID_deals     = Deals.ID_deals
			JOIN	ConcertDeals	ON Deals.CDID            = ConcertDeals.CDID
			JOIN	Concerts		ON ConcertDeals.CID      = Concerts.CID
            JOIN    TypeConcert     ON Concerts.Con_type     = TypeConcert.ID_Type_Con
			JOIN	ShowTime		ON Concerts.CID          = ShowTime.CID
			JOIN	TicketInform	ON Concerts.CID          = TicketInform.CID
			JOIN	TypeTicket		ON TicketInform.Type     = TypeTicket.TID
            JOIN    TypeShow        ON Concerts.Per_type     = TypeShow.ID_Type_Show

			JOIN	HotelDeals		ON Deals.HDID            = HotelDeals.HDID
			JOIN	RoomHotel		ON HotelDeals.ID_room    = RoomHotel.ID_room
			JOIN	Hotels			ON RoomHotel.ID_hotel    = Hotels.ID_hotel
			JOIN	TypeHotel		ON Hotels.Type_hotel     = TypeHotel.ID_Type_Hotel
			JOIN	TypeRoom		ON RoomHotel.Type_room   = TypeRoom.ID_Type_Room
			JOIN	TypeView		ON RoomHotel.Type_view   = TypeView.ID_Type_Room
			JOIN	RoomStatus		ON RoomHotel.Status_room = RoomStatus.ID_Room_Status
        `;
        if (search) {
            query += `
                WHERE Name              LIKE '%${search}%'   OR
                    NameTC              LIKE '%${search}%'   OR
                    LineUP              LIKE '%${search}%'   OR
                    Address             LIKE '%${search}%'   OR
					NameT               LIKE '%${search}%'   OR
                    PriceCD             LIKE '%${search}%'   OR
                    Time                LIKE '%${search}%'   OR
                    Ticket_zone         LIKE '%${search}%'   OR
                    Number_of_ticket    LIKE '%${search}%'   OR
                    NameTS              LIKE '%${search}%'   OR
					
                    NameH               LIKE '%${search}%'   OR
                    AddressH            LIKE '%${search}%'   OR
                    PriceH              LIKE '%${search}%'   OR
                    Total               LIKE '%${search}%'   OR
                    NameTH              LIKE '%${search}%'   OR
					NameTR              LIKE '%${search}%'   OR
                    NameTV              LIKE '%${search}%'   OR
                    NameRS              LIKE '%${search}%'   OR
                    Number_of_room      LIKE '%${search}%'   OR

                    (
                    CASE 
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(StartDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR)
                ) LIKE '%${search}%'   OR
                (
                    CASE 
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
                        WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
                    END + ' ' +
                    FORMAT(EndDate, 'dd', 'th-TH') + ' ' +
                    CASE 
                        WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
                        WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
                        WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
                        WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
                        WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
                        WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
                        WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
                        WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
                        WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
                        WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
                        WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
                        WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
                    END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR)
                ) LIKE '%${search}%' 
            `;
        }

        const result = await sql.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching hotel data:', err);
        res.status(500).send('Internal server error');
    }
});

app.get('/check-user', async (req, res) => {
    const { Email } = req.query;

    if (!Email) {
        return res.status(400).json({ error: 'Please provide an Email' });
    }

    try {
        // Add detailed logging to see what values are being passed
        console.log('Email received:', Email);

        // Database query to fetch user by Email
        const result = await sql.query`
            SELECT ID_user, FL_name, img
            FROM Users
            WHERE Email = ${Email}
        `;

        // If no user is found, return 404
        if (result.recordset.length === 0) {
            console.log('No user found for the given email');
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('User found:', result.recordset[0]);
        res.status(200).json(result.recordset[0]);
    } catch (err) {
        console.error('Error fetching user data:', err);

        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});


app.post('/send-otp', async (req, res) => {
    const { email } = req.body; // ตรวจสอบว่า 'email' ถูกส่งมาจริงหรือไม่

    // ตรวจสอบว่าอีเมลมีค่าหรือไม่
    if (!email) {
        return res.status(400).send('Email is required.'); // ส่งข้อผิดพลาดถ้าอีเมลไม่มีค่า
    }

    try {
        // สร้าง OTP 6 หลัก
        const otp = crypto.randomInt(100000, 999999).toString();

        // Save OTP in the database (OTP + expiry time)
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('email', sql.VarChar, email)
            .input('otp', sql.VarChar, otp)
            .input('expiry', sql.DateTime, new Date(Date.now() + 10 * 60 * 1000)) // OTP มีอายุ 10 นาที
            .query('UPDATE Users SET otp = @otp, otpExpiry = @expiry WHERE email = @email');

        // ส่ง OTP ไปที่อีเมล
        const mailOptions = {
            from: 'nookfe9@gmail.com',
            to: email, // ตรวจสอบว่า 'email' มีค่าและถูกต้อง
            subject: 'TEEMI: OTP for Password Reset',
            text: `Your OTP is ${otp}. It will expire in 10 minutes.`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).send('OTP sent to your email.'); // ส่งข้อความยืนยันการส่ง OTP
    } catch (error) {
        console.error(error);
        res.status(500).send('Error sending OTP.'); // ส่งข้อผิดพลาดถ้าเกิดปัญหา
    }
});

app.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT otp, otpExpiry FROM Users WHERE email = @email');

        if (!result.recordset.length) {
            return res.status(400).send('Email not found.');
        }

        const { otp: storedOtp, otpExpiry } = result.recordset[0];

        if (storedOtp !== otp || new Date() > otpExpiry) {
            return res.status(400).send('Invalid or expired OTP.');
        }

        // เข้ารหัสรหัสผ่านใหม่
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.request()
            .input('email', sql.VarChar, email)
            .input('newPassword', sql.VarChar, hashedPassword) // ใช้รหัสผ่านที่เข้ารหัสแล้ว
            .query('UPDATE Users SET password = @newPassword, otp = NULL, otpExpiry = NULL WHERE email = @email');

        res.status(200).send('Password has been reset successfully.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error resetting password.');
    }
});


app.get('/cancel-concert', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        SELECT Deals.ID_deals, Concerts.CID, ConcertDeals.CDID, HotelDeals.HDID, Poster, Number_of_ticket, PriceCD, NameH, Number_of_room,
                CASE 
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(CONVERT(datetime, S_datetime), 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 1 THEN 'มกราคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 4 THEN 'เมษายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 9 THEN 'กันยายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetime)) + 543 AS NVARCHAR) AS S_datetime_TH, 

                CASE 
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, E_datetime) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(CONVERT(datetime, E_datetime), 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 1 THEN 'มกราคม' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 4 THEN 'เมษายน' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 9 THEN 'กันยายน' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(CONVERT(datetime, E_datetime)) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(CONVERT(datetime, E_datetime)) + 543 AS NVARCHAR) AS E_datetime_TH
        FROM    Deals
        JOIN    HotelDeals      ON Deals.HDID           = HotelDeals.HDID
        JOIN    RoomHotel       ON HotelDeals.ID_room   = RoomHotel.ID_room
        JOIN    Hotels          ON RoomHotel.ID_hotel   = Hotels.ID_hotel
        JOIN    ConcertDeals    ON Deals.CDID           = ConcertDeals.CDID
        JOIN    Concerts        ON ConcertDeals.CID     = Concerts.CID
        WHERE   Deals.StatusD			= 3
        AND     ConcertDeals.StatusCD	= 3
        AND     Hotels.ID_user			= @ID_user
    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Number_of_ticket    LIKE @search OR
                PriceCD             LIKE @search OR
                NameH               LIKE @search OR
                 CASE 
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Monday' THEN 'วันจันทร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Tuesday' THEN 'วันอังคาร'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Wednesday' THEN 'วันพุธ'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Friday' THEN 'วันศุกร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Saturday' THEN 'วันเสาร์'
                    WHEN DATENAME(WEEKDAY, S_datetime) = 'Sunday' THEN 'วันอาทิตย์'
                END + ' ' +
                FORMAT(CONVERT(datetime, S_datetime), 'dd', 'th-TH') + ' ' +
                CASE 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 1 THEN 'มกราคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 2 THEN 'กุมภาพันธ์' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 3 THEN 'มีนาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 4 THEN 'เมษายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 5 THEN 'พฤษภาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 6 THEN 'มิถุนายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 7 THEN 'กรกฎาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 8 THEN 'สิงหาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 9 THEN 'กันยายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 10 THEN 'ตุลาคม' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 11 THEN 'พฤศจิกายน' 
                    WHEN MONTH(CONVERT(datetime, S_datetime)) = 12 THEN 'ธันวาคม' 
                END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetime)) + 543 AS NVARCHAR) LIKE @search OR
                CASE 
            WHEN DATENAME(WEEKDAY, E_datetime) = 'Monday' THEN 'วันจันทร์'
            WHEN DATENAME(WEEKDAY, E_datetime) = 'Tuesday' THEN 'วันอังคาร'
            WHEN DATENAME(WEEKDAY, E_datetime) = 'Wednesday' THEN 'วันพุธ'
            WHEN DATENAME(WEEKDAY, E_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
            WHEN DATENAME(WEEKDAY, E_datetime) = 'Friday' THEN 'วันศุกร์'
            WHEN DATENAME(WEEKDAY, E_datetime) = 'Saturday' THEN 'วันเสาร์'
            WHEN DATENAME(WEEKDAY, E_datetime) = 'Sunday' THEN 'วันอาทิตย์'
        END + ' ' +
        FORMAT(CONVERT(datetime, E_datetime), 'dd', 'th-TH') + ' ' +
        CASE 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 1 THEN 'มกราคม' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 2 THEN 'กุมภาพันธ์' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 3 THEN 'มีนาคม' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 4 THEN 'เมษายน' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 5 THEN 'พฤษภาคม' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 6 THEN 'มิถุนายน' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 7 THEN 'กรกฎาคม' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 8 THEN 'สิงหาคม' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 9 THEN 'กันยายน' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 10 THEN 'ตุลาคม' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 11 THEN 'พฤศจิกายน' 
            WHEN MONTH(CONVERT(datetime, E_datetime)) = 12 THEN 'ธันวาคม' 
        END + ' ' + CAST(YEAR(CONVERT(datetime, E_datetime)) + 543 AS NVARCHAR) LIKE @search

            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } 

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/check-cancel-hotel-offers', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	RankedDeals AS 
                (
                SELECT		HotelDeals.HDID, NameH, RoomHotel.ID_room, ConcertDeals.CDID, 
                            RoomlPicture.Img_Url_room AS MinImg_Url_Hotel, NameTH, NameTR, Number_of_room, PriceH,
                            RoomHotel.ID_hotel, NameTV, Deals.ID_deals,Name, Number_of_ticket, PriceCD, Poster, Concerts.CID, 
                            Con_NumOfRooms, NumOfRooms, Total,
                            CASE 
                                    WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                                    WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                                    WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                                    WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                                    WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                                    WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                                    WHEN DATENAME(WEEKDAY, S_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                                END + ' ' +
                                FORMAT(CONVERT(datetime, S_datetimeHD), 'dd', 'th-TH') + ' ' +
                                CASE 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 1 THEN 'มกราคม' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 2 THEN 'กุมภาพันธ์' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 3 THEN 'มีนาคม' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 4 THEN 'เมษายน' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 5 THEN 'พฤษภาคม' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 6 THEN 'มิถุนายน' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 7 THEN 'กรกฎาคม' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 8 THEN 'สิงหาคม' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 9 THEN 'กันยายน' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 10 THEN 'ตุลาคม' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 11 THEN 'พฤศจิกายน' 
                                    WHEN MONTH(CONVERT(datetime, S_datetimeHD)) = 12 THEN 'ธันวาคม' 
                                END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetimeHD)) + 543 AS NVARCHAR) AS S_datetimeHD_TH, 

                                CASE 
                                    WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Monday' THEN 'วันจันทร์'
                                    WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Tuesday' THEN 'วันอังคาร'
                                    WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Wednesday' THEN 'วันพุธ'
                                    WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Thursday' THEN 'วันพฤหัสบดี'
                                    WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Friday' THEN 'วันศุกร์'
                                    WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Saturday' THEN 'วันเสาร์'
                                    WHEN DATENAME(WEEKDAY, E_datetimeHD) = 'Sunday' THEN 'วันอาทิตย์'
                                END + ' ' +
                                FORMAT(CONVERT(datetime, E_datetimeHD), 'dd', 'th-TH') + ' ' +
                                CASE 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 1 THEN 'มกราคม' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 2 THEN 'กุมภาพันธ์' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 3 THEN 'มีนาคม' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 4 THEN 'เมษายน' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 5 THEN 'พฤษภาคม' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 6 THEN 'มิถุนายน' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 7 THEN 'กรกฎาคม' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 8 THEN 'สิงหาคม' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 9 THEN 'กันยายน' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 10 THEN 'ตุลาคม' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 11 THEN 'พฤศจิกายน' 
                                    WHEN MONTH(CONVERT(datetime, E_datetimeHD)) = 12 THEN 'ธันวาคม' 
                                END + ' ' + CAST(YEAR(CONVERT(datetime, E_datetimeHD)) + 543 AS NVARCHAR) AS E_datetimeHD_TH,
                            ROW_NUMBER() OVER 
                                (
                                    PARTITION BY	HotelDeals.HDID, RoomHotel.ID_room 
                                    ORDER BY		RoomlPicture.Img_Url_room
                                ) 
                            AS rn
                FROM		Deals
                LEFT JOIN	HotelDeals			ON Deals.HDID			= HotelDeals.HDID
                LEFT JOIN	RoomHotel			ON HotelDeals.ID_room	= RoomHotel.ID_room
                LEFT JOIN	Hotels				ON RoomHotel.ID_hotel	= Hotels.ID_hotel
                LEFT JOIN	TypeHotel			ON Hotels.Type_hotel	= TypeHotel.ID_Type_Hotel
                LEFT JOIN	TypeView			ON RoomHotel.Type_view	= TypeView.ID_Type_Room
                LEFT JOIN	TypeRoom			ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
                LEFT JOIN	RoomlPicture		ON RoomHotel.ID_room	= RoomlPicture.ID_room
                LEFT JOIN	ConcertDeals		ON Deals.CDID			= ConcertDeals.CDID
                LEFT JOIN	Concerts			ON ConcertDeals.CID		= Concerts.CID
                LEFT JOIN	ConcertSendDeals	ON ConcertDeals.CDID	= ConcertSendDeals.CDID
                LEFT JOIN	HotelSendDeals		ON HotelDeals.HDID		= HotelSendDeals.HDID
                WHERE		Deals.StatusD = 3
                AND			(HotelSendDeals.StatusHD = 3		OR HotelSendDeals.HDID IS NULL)
                AND			(Concerts.ID_user = @ID_user	OR Concerts.ID_user IS NULL)
                                                        
                )
                SELECT	HDID, NameH, ID_room,CDID ,
                MinImg_Url_Hotel, NameTH, NameTR, Number_of_room, PriceH, ID_hotel, NameTV, ID_deals,
                Name, Number_of_ticket, PriceCD, S_datetimeHD_TH, E_datetimeHD_TH,Poster, CID, Con_NumOfRooms, NumOfRooms, Total
                FROM	RankedDeals
                WHERE	rn = 1
    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Con_NumOfRooms			LIKE @search OR
                NumOfRooms				LIKE @search OR
                NameTH					LIKE @search OR
                NameTR					LIKE @search OR
                Number_of_room			LIKE @search OR
                Total					LIKE @search OR
                NameTV					LIKE @search OR
                Name					LIKE @search OR
                Number_of_ticket		LIKE @search OR
                PriceCD					LIKE @search OR
                S_datetimeHD_TH		    LIKE @search OR
                E_datetimeHD_TH			LIKE @search 

            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } 

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/check-hotel-offers', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        WITH	RankedDeals AS 
                (
                    SELECT		HotelDeals.HDID,Name,  NameH, RoomHotel.ID_room, ConcertDeals.CDID, 
                                RoomlPicture.Img_Url_room AS MinImg_Url_Hotel, NameTH, NameTR, NumOfRooms, PriceH, S_datetimeHD, E_datetimeHD,
                                RoomHotel.ID_hotel, NameTV, Deals.ID_deals, Datetime_match, Total,
                                CASE 
                                WHEN DATENAME(WEEKDAY, Datetime_match) = 'Monday' THEN 'วันจันทร์'
                                WHEN DATENAME(WEEKDAY, Datetime_match) = 'Tuesday' THEN 'วันอังคาร'
                                WHEN DATENAME(WEEKDAY, Datetime_match) = 'Wednesday' THEN 'วันพุธ'
                                WHEN DATENAME(WEEKDAY, Datetime_match) = 'Thursday' THEN 'วันพฤหัสบดี'
                                WHEN DATENAME(WEEKDAY, Datetime_match) = 'Friday' THEN 'วันศุกร์'
                                WHEN DATENAME(WEEKDAY, Datetime_match) = 'Saturday' THEN 'วันเสาร์'
                                WHEN DATENAME(WEEKDAY, Datetime_match) = 'Sunday' THEN 'วันอาทิตย์'
                            END + ' ' +
                            FORMAT(CONVERT(datetime, Datetime_match), 'dd', 'th-TH') + ' ' +
                            CASE 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 1 THEN 'มกราคม' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 2 THEN 'กุมภาพันธ์' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 3 THEN 'มีนาคม' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 4 THEN 'เมษายน' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 5 THEN 'พฤษภาคม' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 6 THEN 'มิถุนายน' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 7 THEN 'กรกฎาคม' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 8 THEN 'สิงหาคม' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 9 THEN 'กันยายน' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 10 THEN 'ตุลาคม' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 11 THEN 'พฤศจิกายน' 
                                WHEN MONTH(CONVERT(datetime, Datetime_match)) = 12 THEN 'ธันวาคม' 
                            END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetimeHD)) + 543 AS NVARCHAR) AS Datetime_match_TH,
                                ROW_NUMBER() OVER 
                                    (
                                        PARTITION BY	HotelDeals.HDID, RoomHotel.ID_room 
                                        ORDER BY		RoomlPicture.Img_Url_room
                                    ) 
                                AS rn
                    FROM		Deals
                    LEFT JOIN	HotelDeals		ON Deals.HDID			= HotelDeals.HDID
                    LEFT JOIN	RoomHotel		ON HotelDeals.ID_room	= RoomHotel.ID_room
                    LEFT JOIN	Hotels			ON RoomHotel.ID_hotel	= Hotels.ID_hotel
                    LEFT JOIN	TypeHotel		ON Hotels.Type_hotel	= TypeHotel.ID_Type_Hotel
                    LEFT JOIN	TypeView		ON RoomHotel.Type_view	= TypeView.ID_Type_Room
                    LEFT JOIN	TypeRoom		ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
                    LEFT JOIN	RoomlPicture	ON RoomHotel.ID_room	= RoomlPicture.ID_room
                    LEFT JOIN	HotelSendDeals	ON HotelDeals.HDID		= HotelSendDeals.HDID
                    LEFT JOIN	ConcertDeals	ON Deals.CDID			= ConcertDeals.CDID
                    LEFT JOIN	Concerts		ON ConcertDeals.CID		= Concerts.CID
                    WHERE		Deals.StatusD = 1
                    AND			(ConcertDeals.StatusCD = 1		OR ConcertDeals.CDID IS NULL)
                    AND			(HotelDeals.StatusHD = 2		OR HotelDeals.HDID IS NULL)
                    AND			(HotelSendDeals.StatusHD = 2		OR HotelSendDeals.HDID IS NULL)
                    AND			(Concerts.ID_user = ${ID_user}	OR Concerts.ID_user IS NULL)
                                
                )
            SELECT	HDID,Name, NameH, ID_room,CDID ,
                    MinImg_Url_Hotel, NameTH, NameTR, NumOfRooms, PriceH, S_datetimeHD, E_datetimeHD, ID_hotel, NameTV, ID_deals, Datetime_match, Datetime_match_TH, Total
            FROM	RankedDeals
            WHERE	rn = 1
    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name					LIKE @search OR
				NameH					LIKE @search OR
				NameTH					LIKE @search OR
				NameTR					LIKE @search OR
				NumOfRooms				LIKE @search OR
				Total					LIKE @search OR
				NameTV					LIKE @search OR
				Datetime_match_TH		LIKE @search 

            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } 

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/check-concert-offers', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
        SELECT  Deals.ID_deals,ConcertDeals.CDID, ConcertDeals.CID, Name, Poster, Number_of_ticket, PriceCD, S_datetime, E_datetime,
				NameH, Con_NumOfRooms, HotelDeals.HDID, Number_of_room, NameTR,NameTV, 
				CASE 
					WHEN DATENAME(WEEKDAY, Datetime_match) = 'Monday' THEN 'วันจันทร์'
					WHEN DATENAME(WEEKDAY, Datetime_match) = 'Tuesday' THEN 'วันอังคาร'
					WHEN DATENAME(WEEKDAY, Datetime_match) = 'Wednesday' THEN 'วันพุธ'
					WHEN DATENAME(WEEKDAY, Datetime_match) = 'Thursday' THEN 'วันพฤหัสบดี'
					WHEN DATENAME(WEEKDAY, Datetime_match) = 'Friday' THEN 'วันศุกร์'
					WHEN DATENAME(WEEKDAY, Datetime_match) = 'Saturday' THEN 'วันเสาร์'
					WHEN DATENAME(WEEKDAY, Datetime_match) = 'Sunday' THEN 'วันอาทิตย์'
				END + ' ' +
				FORMAT(CONVERT(datetime, Datetime_match), 'dd', 'th-TH') + ' ' +
				CASE 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 1 THEN 'มกราคม' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 2 THEN 'กุมภาพันธ์' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 3 THEN 'มีนาคม' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 4 THEN 'เมษายน' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 5 THEN 'พฤษภาคม' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 6 THEN 'มิถุนายน' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 7 THEN 'กรกฎาคม' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 8 THEN 'สิงหาคม' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 9 THEN 'กันยายน' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 10 THEN 'ตุลาคม' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 11 THEN 'พฤศจิกายน' 
					WHEN MONTH(CONVERT(datetime, Datetime_match)) = 12 THEN 'ธันวาคม' 
				END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetimeHD)) + 543 AS NVARCHAR) AS Datetime_match_TH
		FROM    Deals
		JOIN    HotelDeals          ON Deals.HDID           = HotelDeals.HDID
		JOIN    RoomHotel           ON HotelDeals.ID_room   = RoomHotel.ID_room
		JOIN    Hotels              ON RoomHotel.ID_hotel   = Hotels.ID_hotel
		JOIN	TypeRoom			ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
		JOIN	TypeView			ON RoomHotel.Type_view	= TypeView.ID_Type_Room
		JOIN    ConcertDeals        ON Deals.CDID           = ConcertDeals.CDID
		JOIN    Concerts            ON ConcertDeals.CID     = Concerts.CID
		JOIN	ConcertSendDeals    ON ConcertDeals.CDID    = ConcertSendDeals.CDID
		WHERE   Deals.StatusD       = 1
		AND     HotelDeals.StatusHD = 1
		AND     Hotels.ID_user      = ${ID_user}
    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name				LIKE @search OR
				Number_of_ticket	LIKE @search OR
				PriceCD				LIKE @search OR
				NameH				LIKE @search OR
				Con_NumOfRooms		LIKE @search OR
				Number_of_room		LIKE @search OR
				NameTR				LIKE @search OR
				NameTV				LIKE @search OR
				CASE 
				WHEN DATENAME(WEEKDAY, Datetime_match) = 'Monday' THEN 'วันจันทร์'
				WHEN DATENAME(WEEKDAY, Datetime_match) = 'Tuesday' THEN 'วันอังคาร'
				WHEN DATENAME(WEEKDAY, Datetime_match) = 'Wednesday' THEN 'วันพุธ'
				WHEN DATENAME(WEEKDAY, Datetime_match) = 'Thursday' THEN 'วันพฤหัสบดี'
				WHEN DATENAME(WEEKDAY, Datetime_match) = 'Friday' THEN 'วันศุกร์'
				WHEN DATENAME(WEEKDAY, Datetime_match) = 'Saturday' THEN 'วันเสาร์'
				WHEN DATENAME(WEEKDAY, Datetime_match) = 'Sunday' THEN 'วันอาทิตย์'
			END + ' ' +
			FORMAT(CONVERT(datetime, Datetime_match), 'dd', 'th-TH') + ' ' +
			CASE 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 1 THEN 'มกราคม' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 2 THEN 'กุมภาพันธ์' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 3 THEN 'มีนาคม' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 4 THEN 'เมษายน' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 5 THEN 'พฤษภาคม' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 6 THEN 'มิถุนายน' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 7 THEN 'กรกฎาคม' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 8 THEN 'สิงหาคม' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 9 THEN 'กันยายน' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 10 THEN 'ตุลาคม' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 11 THEN 'พฤศจิกายน' 
				WHEN MONTH(CONVERT(datetime, Datetime_match)) = 12 THEN 'ธันวาคม' 
			END + ' ' + CAST(YEAR(CONVERT(datetime, S_datetimeHD)) + 543 AS NVARCHAR) LIKE @search

            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } 

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/concertsdeals-notyou-status', async (req, res) => {
    const { ID_user, search } = req.query;

    let query = `
				SELECT  	Poster, Name, NameTC, LineUP, Address, NameTS, Time, Ticket_zone, Price, Date, Number_of_ticket, PriceCD, S_datetime, E_datetime, NameOS, Concerts.CID, ConcertDeals.CDID,
							CASE 
								WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
								WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
								WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
								WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
								WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
								WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
								WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
							END + ' ' +
							FORMAT(CAST(StartDate AS DATE), 'dd') + ' ' +
							CASE 
								WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
								WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
								WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
								WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
								WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
								WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
								WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
								WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
								WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
								WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
								WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
								WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
							END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) AS StartDate_TH, 

							CASE 
								WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
								WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
								WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
								WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
								WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
								WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
								WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
							END + ' ' +
							FORMAT(CAST(EndDate AS DATE), 'dd') + ' ' +
							CASE 
								WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
								WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
								WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
								WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
								WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
								WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
								WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
								WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
								WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
								WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
								WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
								WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม' 
							END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) AS EndDate_TH,

							CASE 
								WHEN DATENAME(WEEKDAY, S_datetime) = 'Monday' THEN 'วันจันทร์'
								WHEN DATENAME(WEEKDAY, S_datetime) = 'Tuesday' THEN 'วันอังคาร'
								WHEN DATENAME(WEEKDAY, S_datetime) = 'Wednesday' THEN 'วันพุธ'
								WHEN DATENAME(WEEKDAY, S_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
								WHEN DATENAME(WEEKDAY, S_datetime) = 'Friday' THEN 'วันศุกร์'
								WHEN DATENAME(WEEKDAY, S_datetime) = 'Saturday' THEN 'วันเสาร์'
								WHEN DATENAME(WEEKDAY, S_datetime) = 'Sunday' THEN 'วันอาทิตย์'
							END + ' ' +
							FORMAT(CAST(S_datetime AS DATE), 'dd') + ' ' +
							CASE 
								WHEN MONTH(S_datetime) = 1 THEN 'มกราคม' 
								WHEN MONTH(S_datetime) = 2 THEN 'กุมภาพันธ์' 
								WHEN MONTH(S_datetime) = 3 THEN 'มีนาคม' 
								WHEN MONTH(S_datetime) = 4 THEN 'เมษายน' 
								WHEN MONTH(S_datetime) = 5 THEN 'พฤษภาคม' 
								WHEN MONTH(S_datetime) = 6 THEN 'มิถุนายน' 
								WHEN MONTH(S_datetime) = 7 THEN 'กรกฎาคม' 
								WHEN MONTH(S_datetime) = 8 THEN 'สิงหาคม' 
								WHEN MONTH(S_datetime) = 9 THEN 'กันยายน' 
								WHEN MONTH(S_datetime) = 10 THEN 'ตุลาคม' 
								WHEN MONTH(S_datetime) = 11 THEN 'พฤศจิกายน' 
								WHEN MONTH(S_datetime) = 12 THEN 'ธันวาคม' 
							END + ' ' + CAST(YEAR(S_datetime) + 543 AS NVARCHAR) AS S_datetime_TH, 

							CASE 
								WHEN DATENAME(WEEKDAY, E_datetime) = 'Monday' THEN 'วันจันทร์'
								WHEN DATENAME(WEEKDAY, E_datetime) = 'Tuesday' THEN 'วันอังคาร'
								WHEN DATENAME(WEEKDAY, E_datetime) = 'Wednesday' THEN 'วันพุธ'
								WHEN DATENAME(WEEKDAY, E_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
								WHEN DATENAME(WEEKDAY, E_datetime) = 'Friday' THEN 'วันศุกร์'
								WHEN DATENAME(WEEKDAY, E_datetime) = 'Saturday' THEN 'วันเสาร์'
								WHEN DATENAME(WEEKDAY, E_datetime) = 'Sunday' THEN 'วันอาทิตย์'
							END + ' ' +
							FORMAT(CAST(E_datetime AS DATE), 'dd') + ' ' +
							CASE 
								WHEN MONTH(E_datetime) = 1 THEN 'มกราคม' 
								WHEN MONTH(E_datetime) = 2 THEN 'กุมภาพันธ์' 
								WHEN MONTH(E_datetime) = 3 THEN 'มีนาคม' 
								WHEN MONTH(E_datetime) = 4 THEN 'เมษายน' 
								WHEN MONTH(E_datetime) = 5 THEN 'พฤษภาคม' 
								WHEN MONTH(E_datetime) = 6 THEN 'มิถุนายน' 
								WHEN MONTH(E_datetime) = 7 THEN 'กรกฎาคม' 
								WHEN MONTH(E_datetime) = 8 THEN 'สิงหาคม' 
								WHEN MONTH(E_datetime) = 9 THEN 'กันยายน' 
								WHEN MONTH(E_datetime) = 10 THEN 'ตุลาคม' 
								WHEN MONTH(E_datetime) = 11 THEN 'พฤศจิกายน' 
								WHEN MONTH(E_datetime) = 12 THEN 'ธันวาคม' 
							END + ' ' + CAST(YEAR(E_datetime) + 543 AS NVARCHAR) AS E_datetime_TH
                FROM    Concerts
                JOIN    TypeConcert     ON Concerts.Con_type        = TypeConcert.ID_Type_Con
                JOIN    TypeShow        ON Concerts.Per_type        = TypeShow.ID_Type_Show
                JOIN    ShowTime        ON Concerts.CID             = ShowTime.CID
                JOIN    TicketInform    ON Concerts.CID             = TicketInform.CID
                JOIN    ConcertDeals    ON Concerts.CID             = ConcertDeals.CID
                JOIN    OfferStatus     ON ConcertDeals.StatusCD    = OfferStatus.ID_Offer_Status
                WHERE 	ConcertDeals.StatusCD 	 = 1
                AND 	Concerts.ID_user 		!= ${ID_user}
    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: ID_user }];

    if (search) {
        query += `
            AND (
                Name				LIKE @search OR
                Ticket_zone         LIKE @search OR
				NameTC				LIKE @search OR
				LineUP				LIKE @search OR
				Address				LIKE @search OR
				NameTS				LIKE @search OR
				Time				LIKE @search OR
				Ticket_zone			LIKE @search OR
				Price				LIKE @search OR
				Date				LIKE @search OR
				Number_of_ticket	LIKE @search OR
				PriceCD				LIKE @search OR
				NameOS				LIKE @search OR
				CASE 
					WHEN DATENAME(WEEKDAY, StartDate) = 'Monday' THEN 'วันจันทร์'
					WHEN DATENAME(WEEKDAY, StartDate) = 'Tuesday' THEN 'วันอังคาร'
					WHEN DATENAME(WEEKDAY, StartDate) = 'Wednesday' THEN 'วันพุธ'
					WHEN DATENAME(WEEKDAY, StartDate) = 'Thursday' THEN 'วันพฤหัสบดี'
					WHEN DATENAME(WEEKDAY, StartDate) = 'Friday' THEN 'วันศุกร์'
					WHEN DATENAME(WEEKDAY, StartDate) = 'Saturday' THEN 'วันเสาร์'
					WHEN DATENAME(WEEKDAY, StartDate) = 'Sunday' THEN 'วันอาทิตย์'
				END + ' ' +
				FORMAT(CAST(StartDate AS DATE), 'dd') + ' ' +
				CASE 
					WHEN MONTH(StartDate) = 1 THEN 'มกราคม' 
					WHEN MONTH(StartDate) = 2 THEN 'กุมภาพันธ์' 
					WHEN MONTH(StartDate) = 3 THEN 'มีนาคม' 
					WHEN MONTH(StartDate) = 4 THEN 'เมษายน' 
					WHEN MONTH(StartDate) = 5 THEN 'พฤษภาคม' 
					WHEN MONTH(StartDate) = 6 THEN 'มิถุนายน' 
					WHEN MONTH(StartDate) = 7 THEN 'กรกฎาคม' 
					WHEN MONTH(StartDate) = 8 THEN 'สิงหาคม' 
					WHEN MONTH(StartDate) = 9 THEN 'กันยายน' 
					WHEN MONTH(StartDate) = 10 THEN 'ตุลาคม' 
					WHEN MONTH(StartDate) = 11 THEN 'พฤศจิกายน' 
					WHEN MONTH(StartDate) = 12 THEN 'ธันวาคม' 
				END + ' ' + CAST(YEAR(StartDate) + 543 AS NVARCHAR) LIKE @search OR

				CASE 
					WHEN DATENAME(WEEKDAY, EndDate) = 'Monday' THEN 'วันจันทร์'
					WHEN DATENAME(WEEKDAY, EndDate) = 'Tuesday' THEN 'วันอังคาร'
					WHEN DATENAME(WEEKDAY, EndDate) = 'Wednesday' THEN 'วันพุธ'
					WHEN DATENAME(WEEKDAY, EndDate) = 'Thursday' THEN 'วันพฤหัสบดี'
					WHEN DATENAME(WEEKDAY, EndDate) = 'Friday' THEN 'วันศุกร์'
					WHEN DATENAME(WEEKDAY, EndDate) = 'Saturday' THEN 'วันเสาร์'
					WHEN DATENAME(WEEKDAY, EndDate) = 'Sunday' THEN 'วันอาทิตย์'
				END + ' ' +
				FORMAT(CAST(EndDate AS DATE), 'dd') + ' ' +
				CASE 
					WHEN MONTH(EndDate) = 1 THEN 'มกราคม' 
					WHEN MONTH(EndDate) = 2 THEN 'กุมภาพันธ์' 
					WHEN MONTH(EndDate) = 3 THEN 'มีนาคม' 
					WHEN MONTH(EndDate) = 4 THEN 'เมษายน' 
					WHEN MONTH(EndDate) = 5 THEN 'พฤษภาคม' 
					WHEN MONTH(EndDate) = 6 THEN 'มิถุนายน' 
					WHEN MONTH(EndDate) = 7 THEN 'กรกฎาคม' 
					WHEN MONTH(EndDate) = 8 THEN 'สิงหาคม' 
					WHEN MONTH(EndDate) = 9 THEN 'กันยายน' 
					WHEN MONTH(EndDate) = 10 THEN 'ตุลาคม' 
					WHEN MONTH(EndDate) = 11 THEN 'พฤศจิกายน' 
					WHEN MONTH(EndDate) = 12 THEN 'ธันวาคม'  
				END + ' ' + CAST(YEAR(EndDate) + 543 AS NVARCHAR) LIKE @search OR

				CASE 
					WHEN DATENAME(WEEKDAY, S_datetime) = 'Monday' THEN 'วันจันทร์'
					WHEN DATENAME(WEEKDAY, S_datetime) = 'Tuesday' THEN 'วันอังคาร'
					WHEN DATENAME(WEEKDAY, S_datetime) = 'Wednesday' THEN 'วันพุธ'
					WHEN DATENAME(WEEKDAY, S_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
					WHEN DATENAME(WEEKDAY, S_datetime) = 'Friday' THEN 'วันศุกร์'
					WHEN DATENAME(WEEKDAY, S_datetime) = 'Saturday' THEN 'วันเสาร์'
					WHEN DATENAME(WEEKDAY, S_datetime) = 'Sunday' THEN 'วันอาทิตย์'
				END + ' ' +
				FORMAT(CAST(S_datetime AS DATE), 'dd') + ' ' +
				CASE 
					WHEN MONTH(S_datetime) = 1 THEN 'มกราคม' 
					WHEN MONTH(S_datetime) = 2 THEN 'กุมภาพันธ์' 
					WHEN MONTH(S_datetime) = 3 THEN 'มีนาคม' 
					WHEN MONTH(S_datetime) = 4 THEN 'เมษายน' 
					WHEN MONTH(S_datetime) = 5 THEN 'พฤษภาคม' 
					WHEN MONTH(S_datetime) = 6 THEN 'มิถุนายน' 
					WHEN MONTH(S_datetime) = 7 THEN 'กรกฎาคม' 
					WHEN MONTH(S_datetime) = 8 THEN 'สิงหาคม' 
					WHEN MONTH(S_datetime) = 9 THEN 'กันยายน' 
					WHEN MONTH(S_datetime) = 10 THEN 'ตุลาคม' 
					WHEN MONTH(S_datetime) = 11 THEN 'พฤศจิกายน' 
					WHEN MONTH(S_datetime) = 12 THEN 'ธันวาคม' 
				END + ' ' + CAST(YEAR(S_datetime) + 543 AS NVARCHAR) LIKE @search OR

				CASE 
					WHEN DATENAME(WEEKDAY, E_datetime) = 'Monday' THEN 'วันจันทร์'
					WHEN DATENAME(WEEKDAY, E_datetime) = 'Tuesday' THEN 'วันอังคาร'
					WHEN DATENAME(WEEKDAY, E_datetime) = 'Wednesday' THEN 'วันพุธ'
					WHEN DATENAME(WEEKDAY, E_datetime) = 'Thursday' THEN 'วันพฤหัสบดี'
					WHEN DATENAME(WEEKDAY, E_datetime) = 'Friday' THEN 'วันศุกร์'
					WHEN DATENAME(WEEKDAY, E_datetime) = 'Saturday' THEN 'วันเสาร์'
					WHEN DATENAME(WEEKDAY, E_datetime) = 'Sunday' THEN 'วันอาทิตย์'
				END + ' ' +
				FORMAT(CAST(E_datetime AS DATE), 'dd') + ' ' +
				CASE 
					WHEN MONTH(E_datetime) = 1 THEN 'มกราคม' 
					WHEN MONTH(E_datetime) = 2 THEN 'กุมภาพันธ์' 
					WHEN MONTH(E_datetime) = 3 THEN 'มีนาคม' 
					WHEN MONTH(E_datetime) = 4 THEN 'เมษายน' 
					WHEN MONTH(E_datetime) = 5 THEN 'พฤษภาคม' 
					WHEN MONTH(E_datetime) = 6 THEN 'มิถุนายน' 
					WHEN MONTH(E_datetime) = 7 THEN 'กรกฎาคม' 
					WHEN MONTH(E_datetime) = 8 THEN 'สิงหาคม' 
					WHEN MONTH(E_datetime) = 9 THEN 'กันยายน' 
					WHEN MONTH(E_datetime) = 10 THEN 'ตุลาคม' 
					WHEN MONTH(E_datetime) = 11 THEN 'พฤศจิกายน' 
					WHEN MONTH(E_datetime) = 12 THEN 'ธันวาคม' 
				END + ' ' + CAST(YEAR(E_datetime) + 543 AS NVARCHAR) LIKE @search
				

            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    } 

    try {
        const pool = await sql.connect();
        const request = pool.request();

        inputs.forEach(input => {
            request.input(input.name, input.type, input.value);
        });

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (err) {
        console.error('Get concerts query error:', err.message, err.stack);
        res.status(500).send('Server error. Please try again later.');
    }
});


app.get('/roomdeals/:ID_room', async (req, res) => {
    const ID_room = req.params.ID_room;
    try {
      // Query ข้อมูลจาก Hotels และ HotelDeals
    const result = await sql.query`
        SELECT		MIN(RoomlPicture.Img_Url_room) AS MinImg_Url_Hotel,
                    NameH, RoomHotel.ID_room, NameTR, NameTV, NameRS, PriceH, NRoom
        FROM		Hotels 
        JOIN		RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
        JOIN		RoomlPicture	ON RoomHotel.ID_room		= RoomlPicture.ID_room
        JOIN		TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
        JOIN		TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room 
        JOIN		RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
        WHERE		RoomHotel.ID_room = ${ID_room}	
        GROUP BY	NameH, RoomHotel.ID_room, NameTR, NameTV, NameRS, PriceH, NRoom

    `;
    res.json(result.recordset);
    } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Internal server error');
    }
});

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

