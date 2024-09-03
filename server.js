const sql = require('mssql');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors'); // เพิ่มการใช้งาน CORS
const bcrypt = require('bcryptjs'); // Import bcrypt
const { DefaultAzureCredential } = require('@azure/identity');


const app = express();

app.use(express.json());
app.use(cors());



const secretKey = '64011212016';

// การตั้งค่าการเชื่อมต่อฐานข้อมูล
const dbConfig = {
    user: 'APD66_64011212016',
    password: 'ZX0LE35U',
    server: '202.28.34.203\\SQLEXPRESS',
    // server: 'mssql',
    database: 'APD66_64011212016',
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: true,
        connectTimeout: 60000,
        requestTimeout: 60000
        
    }
};

// เชื่อมต่อกับฐานข้อมูล
sql.connect(dbConfig).then(pool => {
    if (pool.connected) {
        console.log('Connected to the database.');
    }
}).catch(err => {
    console.error('Database connection error:', err);
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
        // Hash the password
        const hashedPassword = await bcrypt.hash(Password, 10);
        
        const request = new sql.Request();
        
        // Set parameters for SQL query
        request.input('img', sql.VarChar, img);
        request.input('FL_name', sql.VarChar, FL_name);
        request.input('Nickname', sql.VarChar, Nickname);
        request.input('Birthday', sql.VarChar, Birthday); // Assuming Birthday is in 'YYYY-MM-DD' format
        request.input('Province', sql.VarChar, Province);
        request.input('Email', sql.VarChar, Email);
        request.input('Password', sql.VarChar, hashedPassword); // Use hashed password
        request.input('Phone', sql.VarChar, Phone);
        request.input('Facebook', sql.VarChar, Facebook);
        request.input('ID_Line', sql.VarChar, ID_Line);
            
        // SQL query to insert data into Users table
        const query = `
            INSERT INTO Users (img, FL_name, Nickname, Birthday, Province, Email, Password, Phone, Facebook, ID_Line)
            VALUES (@img, @FL_name, @Nickname, @Birthday, @Province, @Email, @Password, @Phone, @Facebook, @ID_Line);
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
        console.error('Error hashing password:', err);
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
        SELECT * 
        FROM Concerts
        JOIN ShowTime ON Concerts.CID = ShowTime.CID
        JOIN TicketInform ON ShowTime.CID = TicketInform.CID
        JOIN TypeConcert ON Concerts.Con_type = TypeConcert.ID_Type_con
        JOIN TypeShow ON Concerts.Per_type = TypeShow.ID_Type_Show
        WHERE Concerts.ID_user = @ID_user AND Concerts.CID = @CID
        ORDER BY Concerts.CID DESC
    `;
    const inputs = [
        { name: 'ID_user', type: sql.Int, value: id_user },
        { name: 'CID', type: sql.Int, value: cid }
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
        SELECT Poster, Name, Address, Concerts.CID, NameTC, NameTS, Price, NameT
        FROM Concerts
        JOIN TypeConcert ON Concerts.Con_type = TypeConcert.ID_Type_Con
        JOIN ShowTime ON Concerts.CID = ShowTime.CID
        JOIN TypeShow ON Concerts.Per_type = TypeShow.ID_Type_Show
        JOIN TicketInform ON Concerts.CID = TicketInform.CID
        JOIN TypeTicket ON TicketInform.Type = TypeTicket.TID
        WHERE Concerts.ID_user = @ID_user
    `;

    const inputs = [{ name: 'ID_user', type: sql.Int, value: id_user }];

    if (search) {
        query += `
            AND (
                Name LIKE @Search OR
                Address LIKE @Search OR
                NameTC LIKE @Search OR
                NameTS LIKE @Search OR
                Price LIKE @Search OR
                NameT LIKE @Search
            )
        `;
        inputs.push({ name: 'Search', type: sql.NVarChar, value: `%${search}%` });
    }

    try {
        const pool = await sql.connect(/* ใส่รายละเอียดการเชื่อมต่อฐานข้อมูลของคุณที่นี่ */);
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

        // ลบข้อมูลจากตาราง ShowTime ที่เกี่ยวข้องกับ CID
        await pool.request()
            .input('CID', sql.Int, CID)
            .query('DELETE FROM ShowTime WHERE CID = @CID');

        // ลบข้อมูลจากตาราง ChanelConcerts ที่เกี่ยวข้องกับ CID
        await pool.request()
            .input('CID', sql.Int, CID)
            .query('DELETE FROM ChanelConcerts WHERE CID = @CID');

        // ลบข้อมูลจากตาราง ChanelConcerts ที่เกี่ยวข้องกับ CID
        await pool.request()
            .input('CID', sql.Int, CID)
            .query('DELETE FROM TicketInform WHERE CID = @CID');

        // ลบข้อมูลจากตาราง Concerts
        let result = await pool.request()
            .input('CID', sql.Int, CID)
            .input('ID_user', sql.Int, ID_user)
            .query('DELETE FROM Concerts WHERE CID = @CID AND ID_user = @ID_user');

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
    const { CID, ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Pre_date, Quantity_date, Address, Detail, Per_type } = req.body;

    // Validate required fields
    if (!CID || !ID_user || !Show_secheduld || !Poster || !Name || !LineUP || !Con_type || !Pre_date || !Quantity_date || !Address || !Detail || !Per_type) {
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
        request.input('CID', sql.Int, numericCID);
        request.input('ID_user', sql.Int, ID_user);
        request.input('Show_secheduld', sql.VarChar, Show_secheduld);
        request.input('Poster', sql.VarChar, Poster);
        request.input('Name', sql.VarChar, Name);
        request.input('LineUP', sql.Text, LineUP);
        request.input('Con_type', sql.Int, parseInt(Con_type, 10)); // Ensure Con_type is an integer
        request.input('Pre_date', sql.VarChar, Pre_date);
        request.input('Quantity_date', sql.Int, numericQuantityDate);
        request.input('Address', sql.VarChar, Address);
        request.input('Detail', sql.Text, Detail);
        request.input('Per_type', sql.Int, parseInt(Per_type, 10)); // Ensure Per_type is an integer

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
            SET Show_secheduld = @Show_secheduld, 
                Poster = @Poster, 
                Name = @Name, 
                LineUP = @LineUP, 
                Con_type = @Con_type, 
                Pre_date = @Pre_date, 
                Quantity_date = @Quantity_date, 
                Address = @Address, 
                Detail = @Detail, 
                Per_type = @Per_type
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
    const { ticketZone, price, type, date } = req.body;

    // Validate required fields
    if (!CID || !ticketZone || !price || !type || !date) {
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
            UPDATE TicketInform
            SET Ticket_zone = @ticketZone, Price = @price, Type = @type, Date = @date
            WHERE CID = @CID
        `;

        // Set parameters for SQL query
        request.input('CID', sql.Int, CID);
        request.input('ticketZone', sql.VarChar, ticketZone);
        request.input('price', sql.Int, price);
        request.input('type', sql.Int, type);
        request.input('date', sql.Date, date);

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
    const { ID_hotel, Type_view, PriceH, Status_room, Type_room } = req.body;

    // Log the incoming request body for debugging
    console.log('Received request body:', req.body);

    // Validate required fields and types
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

    try {
        const request = new sql.Request();

        // Verify ID_hotel exists in the database
        request.input('ID_hotel', sql.Int, ID_hotel);
        const verifyQuery = 'SELECT COUNT(*) AS hotelCount FROM Hotels WHERE ID_hotel = @ID_hotel';
        const verifyResult = await request.query(verifyQuery);

        if (verifyResult.recordset[0].hotelCount === 0) {
            return res.status(404).send('No hotel found with the given ID_hotel.');
        }

        // Set parameters for SQL query
        request.input('Type_view', sql.Int, Type_view);
        request.input('PriceH', sql.Int, PriceH);
        request.input('Status_room', sql.VarChar, Status_room);
        request.input('Type_room', sql.Int, Type_room);

        // SQL query to insert data into RoomHotel table and return the inserted ID_room
        const insertQuery = `
            INSERT INTO RoomHotel (ID_hotel, Type_view, PriceH, Status_room, Type_room)
            OUTPUT inserted.ID_room
            VALUES (@ID_hotel, @Type_view, @PriceH, @Status_room, @Type_room)
        `;

        // Execute the query
        const insertResult = await request.query(insertQuery);
        const ID_room = insertResult.recordset[0].ID_room;
        
        res.send(`Room inserted successfully with ID_room: ${ID_room}.`);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Server error. Please try again later.');
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
    const { search } = req.query; // Get the search query parameter

    if (!id_user) {
        return res.status(400).send('ID_user is required.');
    }

    let query = `
        SELECT MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel, Hotels.ID_hotel, 
               NameH, AddressH
        FROM Hotels
        JOIN RoomHotel ON Hotels.ID_hotel = RoomHotel.ID_hotel
        JOIN TypeHotel ON Hotels.Type_hotel = TypeHotel.ID_Type_Hotel
        JOIN TypeRoom ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
        JOIN TypeView ON RoomHotel.Type_view = TypeView.ID_Type_Room
        JOIN HotelPicture ON Hotels.ID_hotel = HotelPicture.ID_hotel
        JOIN RoomStatus ON RoomHotel.Status_room = RoomStatus.ID_Room_Status
        WHERE Hotels.ID_user = @ID_user
    `;

    const inputs = [
        { name: 'ID_user', type: sql.Int, value: id_user }
    ];

    // Add search criteria if search query is provided
    if (search) {
        query += `
            AND (
                NameH LIKE @search OR
                AddressH LIKE @search OR
                DetailH LIKE @search OR
                TypeHotel.NameTH LIKE @search OR
                TypeRoom.NameTR LIKE @search OR
                TypeView.NameTV LIKE @search OR
                RoomStatus.NameRS LIKE @search
            )
        `;
        inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
    }

    query += `
        GROUP BY Hotels.ID_hotel, NameH, AddressH;
    `;

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

        const roomPicturesResult = await sql.query`SELECT RoomlPicture.Img_Url_Room 
                                                    FROM RoomlPicture, RoomHotel 
                                                    WHERE RoomHotel.ID_hotel = ${ID_hotel}
                                                    AND RoomHotel.ID_room = RoomlPicture.ID_room`;
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
        SELECT h.*, r.*
        FROM Hotels h
        LEFT JOIN RoomHotel r ON h.ID_hotel = r.ID_hotel
        WHERE h.ID_hotel = ${ID_hotel}
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
            UPDATE Hotels
            SET NameH = ${NameH}, AddressH = ${AddressH}, Type_hotel = ${Type_hotel}, DetailH = ${DetailH}
            WHERE ID_hotel = ${ID_hotel}
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
    const { Type_view, Status_room, PriceH } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!Type_view || !Status_room || !PriceH) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // ตรวจสอบว่ามีการเชื่อมต่อกับฐานข้อมูล
        console.log(`Updating RoomHotel with ID ${ID_room}`);

        // Query อัพเดทข้อมูลใน RoomHotel
        const result = await sql.query`
            UPDATE RoomHotel
            SET Type_view = ${Type_view}, Status_room = ${Status_room}, PriceH = ${PriceH}
            WHERE ID_room = ${ID_room}
        `;
        
        // ตรวจสอบผลลัพธ์ของการอัพเดท
        if (result.rowCount === 0) {
            return res.status(404).send('Hotel not found');
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
    const result = await sql.query`SELECT RoomlPicture.Img_Url_Room 
                                                    FROM RoomlPicture, RoomHotel 
                                                    WHERE RoomHotel.ID_room = ${ID_room}
                                                    AND RoomHotel.ID_room = RoomlPicture.ID_room`;
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
        SELECT *
        FROM Concerts, ConcertDeals
        WHERE Concerts.CID = ${CID}
        AND Concerts.CID = ConcertDeals.CID
        AND ConcertDeals.StatusCD = 2
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
        SELECT *
        FROM Concerts, ConcertDeals
        WHERE Concerts.CID = ${CID}
        AND Concerts.CID = ConcertDeals.CID
        AND ConcertDeals.StatusCD = 1
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
    const { ID_room, Number_of_room, S_datetimeHD, E_datetimeHD, StatusHD } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!ID_room || !Number_of_room || !S_datetimeHD || !E_datetimeHD || !StatusHD ) {
    return res.status(400).send('Missing required fields');
    }

    try {
      // Query เพิ่มข้อมูลใน HotelDeals
    await sql.query`
        INSERT INTO HotelDeals (ID_room, Number_of_room, S_datetimeHD, E_datetimeHD, StatusHD )
        VALUES (${ID_room}, ${Number_of_room}, ${S_datetimeHD}, ${E_datetimeHD}, ${StatusHD} )
    `;

    res.send('Insert successful');
    } catch (err) {
    console.error('Error inserting into the database:', err);
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
    const { Number_of_room, S_datetimeHD, E_datetimeHD } = req.body;

    // ตรวจสอบว่าข้อมูลครบถ้วน
    if (!Number_of_room || !S_datetimeHD || !E_datetimeHD ) {
    return res.status(400).send('Missing required fields');
    }

    try {
      // Query อัพเดทข้อมูลใน HotelDeals
    await sql.query`
        UPDATE HotelDeals
        SET Number_of_room = ${Number_of_room}, S_datetimeHD = ${S_datetimeHD}, E_datetimeHD = ${E_datetimeHD}
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

        // เลือก ID_room ตาม ID_hotel
        const roomResult = await request.query(`SELECT ID_room FROM RoomHotel WHERE ID_hotel = ${ID_hotel}`);
        const ID_rooms = roomResult.recordset.map(record => record.ID_room);

        // ลบภาพของห้องก่อนลบห้อง
        for (let ID_room of ID_rooms) {
            await request.query(`DELETE FROM RoomlPicture WHERE ID_room = ${ID_room}`);
        }

        // ลบข้อมูลที่เกี่ยวข้อง
        await request.query(`DELETE FROM HotelPicture WHERE ID_hotel = ${ID_hotel}`);
        await request.query(`DELETE FROM RoomHotel WHERE ID_hotel = ${ID_hotel}`);
        await request.query(`DELETE FROM ChanelHotel WHERE ID_hotel = ${ID_hotel}`);
        await request.query(`DELETE FROM HotelDeals WHERE ID_hotel = ${ID_hotel}`);

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
        SELECT * 
        FROM OfferStatus
        WHERE ID_Offer_Status = ${statusHD}
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
        SELECT * 
        FROM HotelDeals,Hotels,TypeHotel
        WHERE StatusHD = ${statusHD}
        AND	HotelDeals.ID_hotel = Hotels.ID_hotel
        AND Hotels.Type_room = TypeHotel.ID_Type_Hotel

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
        SELECT * 
        FROM ConcertDeals,Concerts
        WHERE StatusCD = ${statusCD}
        AND	ConcertDeals.CID = Concerts.CID

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

    if (!cid) {
        return res.status(400).send('CID is required.');
    }

    const query = `
        SELECT * 
        FROM Concerts
        JOIN ShowTime ON Concerts.CID = ShowTime.CID
        JOIN TicketInform ON ShowTime.CID = TicketInform.CID
        JOIN TypeConcert ON Concerts.Con_type = TypeConcert.ID_Type_con
        JOIN TypeShow ON Concerts.Per_type = TypeShow.ID_Type_Show
        WHERE Concerts.CID = @CID
        ORDER BY Concerts.CID DESC
    `;
    const inputs = [
        { name: 'CID', type: sql.Int, value: cid }
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

app.get('/concertsdeals-notyou-status/:statusCD/:ID_user', async (req, res) => {
    const { statusCD, ID_user } = req.params;
    const queryParams = req.query;

    try {
        let query = `
            SELECT Poster, Name, NameTC, LineUP, Pre_date, Address, NameTS, Time, Ticket_zone, Price, Date, Number_of_ticket, PriceCD, S_datetime, E_datetime, NameOS,Concerts.CID, ConcertDeals.CDID
            FROM Concerts
            JOIN TypeConcert ON Concerts.Con_type = TypeConcert.ID_Type_Con
            JOIN TypeShow ON Concerts.Per_type = TypeShow.ID_Type_Show
            JOIN ShowTime ON Concerts.CID = ShowTime.CID
            JOIN TicketInform ON Concerts.CID = TicketInform.CID
            JOIN ConcertDeals ON Concerts.CID = ConcertDeals.CID
            JOIN OfferStatus ON ConcertDeals.StatusCD = OfferStatus.ID_Offer_Status
            WHERE ConcertDeals.StatusCD = ${statusCD}
            AND Concerts.ID_user != ${ID_user}
        `;

        Object.keys(queryParams).forEach((key, index) => {
            if (index === 0) {
                query += ` AND ${key} LIKE '%${queryParams[key]}%'`;
            } else {
                query += ` AND ${key} LIKE '%${queryParams[key]}%'`;
            }
        });

        const result = await sql.query(query);

        if (result.recordset.length === 0) {
            res.status(404).send('No concert deals found for the given StatusCD and search criteria');
            return;
        }

        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching concert deals:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/hoteldeals-notyou-status/:statusHD/:ID_user', async (req, res) => {
    const { statusHD, ID_user } = req.params;
    const { search, Number_of_room, PriceH, S_datetimeHD, E_datetimeHD } = req.query;

    try {
        let query = `
            SELECT      MIN(RoomlPicture.Img_Url_room) AS Img_Url_room,
                        Hotels.ID_hotel, HDID, Number_of_room, PriceH, NameTH, NameTR, NameTV, AddressH, S_datetimeHD, E_datetimeHD, NameH, NameOS
            FROM        HotelDeals 
            JOIN        RoomHotel       ON HotelDeals.ID_room    = RoomHotel.ID_room
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
                    NameOS    LIKE '%${search}%'
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
            GROUP BY    Hotels.ID_hotel, HDID, Number_of_room, PriceH, NameTH, NameTR, NameTV, AddressH, S_datetimeHD, E_datetimeHD, NameH, NameOS
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




app.post('/add-deals-update-hdid', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD } = req.body;

    // Check if all required fields are provided
    if (!HDID || !CDID || !Datetime_match || !StatusD) {
        return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, and StatusD');
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();
        const request1 = new sql.Request(transaction);

        // Insert into Deals table
        await request1.query`
            INSERT INTO Deals (HDID, CDID, Datetime_match, StatusD)
            VALUES (${HDID}, ${CDID}, ${Datetime_match}, ${StatusD})
        `;

        const request2 = new sql.Request(transaction);

        // Update HotelDeals table
        await request2.query`
            UPDATE HotelDeals
            SET StatusHD = 2
            WHERE HDID = ${HDID}
        `;

        await transaction.commit();
        res.status(201).send('Deal added and HotelDeals status updated successfully');
    } catch (err) {
        await transaction.rollback();
        console.error('Error adding deal and updating HotelDeals status:', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/add-deals-update-cdid', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD } = req.body;

    if (!HDID || !CDID || !Datetime_match || !StatusD) {
        return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, and StatusD');
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

        await transaction.commit();
        res.status(201).send('Deal added and ConcertDeals status updated successfully');
    } catch (err) {
        await transaction.rollback();
        console.error('Error adding deal and updating ConcertDeals status:', err);
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับแสดงข้อมูลทั้งหมดตาม ID_user
app.get('/check-hotel-offers', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
    return res.status(400).send('Please provide an ID_user');
    }

    try {
    const result = await sql.query`
        WITH	RankedDeals AS 
            (
                SELECT		HotelDeals.HDID, NameH, RoomHotel.ID_room, ConcertDeals.CDID, 
                            RoomlPicture.Img_Url_room AS MinImg_Url_Hotel, NameTH, NameTR, Number_of_room, PriceH, S_datetimeHD, E_datetimeHD,
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
                LEFT JOIN	ConcertDeals	ON Deals.CDID			= ConcertDeals.CDID
                LEFT JOIN	Concerts		ON ConcertDeals.CID		= Concerts.CID
                WHERE		Deals.StatusD = 1
                AND			(ConcertDeals.StatusCD = 1		OR ConcertDeals.CDID IS NULL)
                AND			(Concerts.ID_user = ${ID_user}	OR Concerts.ID_user IS NULL)
                    
            )
        SELECT	HDID, NameH, ID_room,CDID ,
                MinImg_Url_Hotel, NameTH, NameTR, Number_of_room, PriceH, S_datetimeHD, E_datetimeHD, ID_hotel, NameTV, ID_deals
        FROM	RankedDeals
        WHERE	rn = 1
    `;

    res.status(200).json(result.recordset);
    } catch (err) {
    console.error('Error fetching hotel offers:', err);
    res.status(500).send('Internal server error');
    }
});

app.get('/check-concert-offers', async (req, res) => {
    const { ID_user } = req.query;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        const result = await sql.query`
            SELECT *
            FROM Deals
            JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
            JOIN RoomHotel ON HotelDeals.ID_room = RoomHotel.ID_room
            JOIN Hotels ON RoomHotel.ID_hotel = Hotels.ID_hotel
            JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
            JOIN Concerts ON ConcertDeals.CID = Concerts.CID
            WHERE Deals.StatusD = 1
            AND HotelDeals.StatusHD = 1
            AND Hotels.ID_user = ${ID_user}
        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching concert offers:', err);
        res.status(500).send('Internal server error');
    }
});



// Endpoint สำหรับการกดปุ่ม Yes
app.post('/confirm-concert-offer', async (req, res) => {
    const { CDID, ID_deals, Deadline_package, S_Deadline_package } = req.body;

    if (!CDID || !ID_deals || !Deadline_package || !S_Deadline_package) {
        return res.status(400).send('Please provide all required fields: CDID, ID_deals, Deadline_package, and S_Deadline_package');
    }

    try {
        // Initialize the connection and transaction
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
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

            // Commit transaction
            await transaction.commit();
            res.status(200).send('Concert offer confirmed and package created successfully');
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
app.post('/confirm-hotel-offer', async (req, res) => {
    const { HDID, CDID, ID_deals, Deadline_package, S_Deadline_package } = req.body;

    if (!HDID || !CDID || !ID_deals || !Deadline_package || !S_Deadline_package) {
        return res.status(400).json({ message: 'Please provide all required fields: HDID, ID_deals, Deadline_package, and S_Deadline_package' });
    }

    try {
        const transaction = new sql.Transaction();
        await transaction.begin();

        try {
            console.log('Inserting into Package', { ID_deals, Deadline_package, S_Deadline_package });

            const insertRequest = new sql.PreparedStatement(transaction);
            insertRequest.input('ID_deals', sql.Int);
            insertRequest.input('Deadline_package', sql.Date);
            insertRequest.input('S_Deadline_package', sql.Date);

            await insertRequest.prepare(`
                INSERT INTO Packeage (ID_deals, Deadline_package, S_Deadline_package)
                VALUES (@ID_deals, @Deadline_package, @S_Deadline_package)
            `);
            await insertRequest.execute({
                ID_deals: ID_deals,
                Deadline_package: new Date(Deadline_package),
                S_Deadline_package: new Date(S_Deadline_package)
            });
            await insertRequest.unprepare();

            console.log('Updating Deals status for ID_deals:', ID_deals);

            const concertDealsRequest = new sql.PreparedStatement(transaction);
            concertDealsRequest.input('CDID', sql.Int);

            await concertDealsRequest.prepare(`
                UPDATE ConcertDeals
                SET StatusCD = 2
                WHERE CDID = @CDID
            `);
            await concertDealsRequest.execute({ CDID: CDID });
            await concertDealsRequest.unprepare();

            const updateRequest = new sql.PreparedStatement(transaction);
            updateRequest.input('ID_deals', sql.Int);

            await updateRequest.prepare(`
                UPDATE Deals
                SET StatusD = 2
                WHERE ID_deals = @ID_deals
            `);
            await updateRequest.execute({ ID_deals: ID_deals });
            await updateRequest.unprepare();

            await transaction.commit();
            res.status(200).json({ message: 'Concert offer confirmed and package created successfully' });
        } catch (err) {
            await transaction.rollback();
            console.error('Transaction error:', err); // ล็อกข้อผิดพลาดอย่างละเอียด
            res.status(500).json({ message: 'Transaction error', error: err.message || 'Unknown error occurred' });
        }
    } catch (err) {
        console.error('Error confirming concert offer:', err);
        res.status(500).json({ message: 'Internal server error', error: err.message || 'Unknown error occurred' });
    }
});


app.post('/cancel-concert-offers', async (req, res) => {
    const { CDID } = req.body;

    if (!CDID) {
        return res.status(400).send('Please provide the CDID');
    }

    const cdidValue = Array.isArray(CDID) ? CDID[0] : CDID;

    try {
        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();
        const request = new sql.Request(transaction);

        // Declare the parameter only once
        request.input('CDID', sql.VarChar, cdidValue);

        // Update StatusCD in ConcertDeals
        const updateResult = await request.query(`
            UPDATE ConcertDeals
            SET StatusCD = 1
            WHERE CDID = @CDID
        `);

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Concert offer not found');
        }

        // Delete deal from Deals
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
        console.error('Error cancelling concert offer and deleting deal:', err.message); // Log the error message
        res.status(500).send('Internal server error');
    }
});




app.post('/cancel-hotel-offers', async (req, res) => {
    const { HDID } = req.body;

    if (!HDID) {
        return res.status(400).send('Please provide the HDID');
    }

    const hdidValue = Array.isArray(HDID) ? HDID[0] : HDID;

    try {
        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();
        const request = new sql.Request(transaction);

        // Declare the parameter only once
        request.input('HDID', sql.VarChar, hdidValue);

        // Update StatusHD in hotelDeals
        const updateResult = await request.query(`
            UPDATE hotelDeals
            SET StatusHD = 1
            WHERE HDID = @HDID
        `);

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Hotel offer not found');
        }

        // Delete deal from Deals
        const deleteResult = await request.query(`
            DELETE FROM Deals
            WHERE HDID = @HDID
        `);

        if (deleteResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).send('Deal not found');
        }

        await transaction.commit();
        res.status(200).send('Hotel offer cancelled and deal deleted successfully');
    } catch (err) {
        console.error('Error cancelling hotel offer and deleting deal:', err.message); 
        res.status(500).send('Internal server error');
    }
});


// Endpoint สำหรับแสดงข้อมูลจากหลายตารางโดยเช็คจาก ID_user
app.get('/package/:ID_user', async (req, res) => {
    const { ID_user } = req.params;

    if (!ID_user) {
        return res.status(400).send('Please provide an ID_user');
    }

    try {
        const result = await sql.query`
            SELECT Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, Packeage.ID_deals,Hotels.ID_hotel, Concerts.CID 
            FROM Packeage
            JOIN Deals ON Packeage.ID_deals = Deals.ID_deals
            JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
            JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
            JOIN Hotels ON HotelDeals.ID_hotel = Hotels.ID_hotel
            JOIN Concerts ON ConcertDeals.CID = Concerts.CID
            JOIN TicketInform ON Concerts.CID = TicketInform.CID
            JOIN RoomHotel ON Hotels.ID_hotel = RoomHotel.ID_hotel
            WHERE Concerts.ID_user = ${ID_user}
            GROUP BY Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, Packeage.ID_deals,Hotels.ID_hotel, Concerts.CID
            
            UNION 
            
            SELECT Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster,Packeage.ID_deals,Hotels.ID_hotel, Concerts.CID 
            FROM Packeage
            JOIN Deals ON Packeage.ID_deals = Deals.ID_deals
            JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
            JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
            JOIN Hotels ON HotelDeals.ID_hotel = Hotels.ID_hotel
            JOIN Concerts ON ConcertDeals.CID = Concerts.CID
            JOIN TicketInform ON Concerts.CID = TicketInform.CID
            JOIN RoomHotel ON Hotels.ID_hotel = RoomHotel.ID_hotel
            WHERE Hotels.ID_user = ${ID_user}
            GROUP BY Name, NameH, Number_of_ticket, Number_of_room, PriceH, Address, AddressH, Ticket_zone, Price, Poster, Packeage.ID_deals,Hotels.ID_hotel, Concerts.CID

        `;

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching package data:', err);
        res.status(500).send('Internal server error');
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

    try {
        const result = await sql.query`
            SELECT * 
            FROM ConcertDeals, Concerts
            WHERE ConcertDeals.StatusCD = ${statusCD}
            AND ConcertDeals.CID = Concerts.CID
            AND Concerts.ID_user = ${ID_user}
        `;

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
    const ID_user = req.params.ID_user; // Corrected parameter name
    try {
        // Query data from Hotels and HotelDeals
        const result = await sql.query`
            SELECT *
            FROM Hotels
            INNER JOIN HotelDeals ON HotelDeals.ID_hotel = Hotels.ID_hotel
            WHERE HotelDeals.StatusHD = 1
            AND Hotels.ID_user = ${ID_user}
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying the database:', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/add-deals-update-insert-cdid', async (req, res) => {
    const { HDID, CDID, Datetime_match, StatusD, Deadline_package, S_Deadline_package } = req.body;

    if (!HDID || !CDID || !Datetime_match || !StatusD || !Deadline_package || !S_Deadline_package) {
        return res.status(400).send('Please provide all required fields: HDID, CDID, Datetime_match, StatusD, Deadline_package, and S_Deadline_package');
    }

    const transaction = new sql.Transaction();

    try {
        await transaction.begin();
        const request1 = new sql.Request(transaction);

        // Set parameters for request1
        request1.input('HDID', sql.Int, HDID);
        request1.input('CDID', sql.Int, CDID);
        request1.input('Datetime_match', sql.DateTime, Datetime_match);
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
        request2.input('ID_deals', sql.Int, ID_deals);
        request2.input('Deadline_package', sql.DateTime, Deadline_package);
        request2.input('S_Deadline_package', sql.DateTime, S_Deadline_package);

        // Update ConcertDeals table
        await request2.query(`
            UPDATE ConcertDeals
            SET StatusCD = 2
            WHERE CDID = @CDID
        `);

        // Insert into Package table
        await request2.query(`
            INSERT INTO Packeage (ID_deals, Deadline_package, S_Deadline_package)
            VALUES (@ID_deals, @Deadline_package, @S_Deadline_package)
        `);

        await transaction.commit();
        res.status(201).send('Deal added, ConcertDeals status updated, and Package created successfully');
    } catch (err) {
        await transaction.rollback();
        console.error('Error adding deal, updating ConcertDeals status, and creating Package:', err);
        res.status(500).send('Internal server error');
    }
});


app.get('/hotel-and-search', async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT		MIN(HotelPicture.Img_Url_Hotel) AS Img_Url_Hotel, Hotels.ID_hotel, NameH,  
			NameTH, MIN(TypeRoom.NameTR) AS NameTR, MIN(TypeView.NameTV) AS NameTV, AddressH, MIN(RoomHotel.PriceH) AS PriceH, NameRS
            FROM		Hotels
            JOIN		RoomHotel		ON Hotels.ID_hotel			= RoomHotel.ID_hotel
            JOIN		TypeHotel		ON Hotels.Type_hotel		= TypeHotel.ID_Type_Hotel
            JOIN		TypeRoom		ON RoomHotel.Type_room		= TypeRoom.ID_Type_Room
            JOIN		TypeView		ON RoomHotel.Type_view		= TypeView.ID_Type_Room
            JOIN		HotelPicture	ON Hotels.ID_hotel			= HotelPicture.ID_hotel
            JOIN		RoomStatus		ON RoomHotel.Status_room	= RoomStatus.ID_Room_Status
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
            SELECT	Concerts.CID, Poster, Name, Address, Ticket_zone, Price, Pre_date,NameT, NameTC, Time, NameTS
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
                    Price           LIKE '%${search}%' OR
                    Pre_date        LIKE '%${search}%' OR
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


app.get('/packeage-and-search', async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT	Concerts.CID, Poster, Name, NameTC, LineUP, Pre_date, Address, NameT, PriceCD, Time, Ticket_zone,Number_of_ticket, NameTS,
			Hotels.ID_hotel ,NameH, AddressH, PriceH, NameTH, NameTR, NameTV, NameRS, Number_of_room
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
                    Pre_date            LIKE '%${search}%'   OR
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
                    NameTH              LIKE '%${search}%'   OR
					NameTR              LIKE '%${search}%'   OR
                    NameTV              LIKE '%${search}%'   OR
                    NameRS              LIKE '%${search}%'   OR
                    Number_of_room      LIKE '%${search}%'
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
            SELECT ID_Type_Con, NameTC
            FROM TypeConcert
            WHERE ID_Type_Con = ${Con_type}
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
                        SELECT		HotelDeals.HDID, ISNULL(ConcertDeals.CDID, Deals.CDID) AS CDID,
                                    NameH, RoomHotel.ID_room, RoomlPicture.Img_Url_room AS MinImg_Url_Hotel,
                                    NameTH, NameTR, Number_of_room, PriceH, S_datetimeHD, E_datetimeHD, RoomHotel.ID_hotel, NameTV, Deals.ID_deals,
                                    ROW_NUMBER() OVER 
                                    (
                                        PARTITION BY HotelDeals.HDID, RoomHotel.ID_room 
                                        ORDER BY RoomlPicture.Img_Url_room
                                    ) AS rn
                        FROM		Deals
                        LEFT JOIN	HotelDeals		ON Deals.HDID			= HotelDeals.HDID
                        LEFT JOIN	RoomHotel		ON HotelDeals.ID_room	= RoomHotel.ID_room
                        LEFT JOIN	Hotels			ON RoomHotel.ID_hotel	= Hotels.ID_hotel
                        LEFT JOIN	TypeHotel		ON Hotels.Type_hotel	= TypeHotel.ID_Type_Hotel
                        LEFT JOIN	TypeView		ON RoomHotel.Type_view	= TypeView.ID_Type_Room
                        LEFT JOIN	TypeRoom		ON RoomHotel.Type_room	= TypeRoom.ID_Type_Room
                        LEFT JOIN	RoomlPicture	ON RoomHotel.ID_room	= RoomlPicture.ID_room
                        LEFT JOIN	ConcertDeals	ON Deals.CDID			= ConcertDeals.CDID
                        LEFT JOIN	Concerts		ON ConcertDeals.CID		= Concerts.CID
                        WHERE		Deals.StatusD				= 1
                        AND			(ConcertDeals.StatusCD		= 1				OR ConcertDeals.CDID IS NULL)
                        AND			(Concerts.ID_user			= ${ID_user}	OR Concerts.ID_user IS NULL)
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
            SELECT		COUNT(*) as offerCount
            FROM		Deals
            JOIN		HotelDeals		ON Deals.HDID			= HotelDeals.HDID
            JOIN		RoomHotel		ON HotelDeals.ID_room	= RoomHotel.ID_room
            JOIN		Hotels			ON RoomHotel.ID_hotel	= Hotels.ID_hotel
            JOIN		ConcertDeals	ON Deals.CDID			= ConcertDeals.CDID
            JOIN		Concerts		ON ConcertDeals.CID		= Concerts.CID
            WHERE		Deals.StatusD = 1
            AND			HotelDeals.StatusHD = 1
            AND			Hotels.ID_user = ${ID_user}
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
            SELECT COUNT(*) as offerCountHotel, 
                Deals.ID_deals, 
                ConcertDeals.CDID, 
                Concerts.CID, 
                HotelDeals.HDID, 
                Hotels.ID_hotel
            FROM Deals
            JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
            JOIN Concerts ON ConcertDeals.CID = Concerts.CID
            JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
            JOIN RoomHotel ON HotelDeals.ID_room = RoomHotel.ID_room
            JOIN Hotels ON RoomHotel.ID_hotel = Hotels.ID_hotel
            WHERE Deals.StatusD = 1
            AND ConcertDeals.StatusCD = 1
            AND Concerts.ID_user = ${ID_user}
            GROUP BY Deals.ID_deals, 
                    ConcertDeals.CDID, 
                    Concerts.CID, 
                    HotelDeals.HDID, 
                    Hotels.ID_hotel
        `;

        const resultConcertOffers = await sql.query`
            SELECT COUNT(*) as offerCount, 
                Deals.ID_deals, 
                HotelDeals.HDID, 
                Hotels.ID_hotel, 
                ConcertDeals.CDID, 
                Concerts.CID
            FROM Deals
            JOIN HotelDeals ON Deals.HDID = HotelDeals.HDID
            JOIN Hotels ON HotelDeals.ID_hotel = Hotels.ID_hotel
            JOIN ConcertDeals ON Deals.CDID = ConcertDeals.CDID
            JOIN Concerts ON ConcertDeals.CID = Concerts.CID
            WHERE Deals.StatusD = 1
            AND HotelDeals.StatusHD = 1
            AND Hotels.ID_user = ${ID_user}
            GROUP BY Deals.ID_deals, 
                    HotelDeals.HDID, 
                    Hotels.ID_hotel, 
                    ConcertDeals.CDID, 
                    Concerts.CID
        `;

        res.status(200).json({
            hotelOffers: resultHotelOffers.recordset,
            concertOffers: resultConcertOffers.recordset
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).send('Internal server error');
    }
});



app.post('/concerts', async (req, res) => {
    const { ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Pre_date, Quantity_date, Address, Detail, Per_type } = req.body;

    // Debugging: ตรวจสอบข้อมูลที่รับจากคำขอ
    console.log('Received data:', { ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Pre_date, Quantity_date, Address, Detail, Per_type });

    // Validate required fields
    if (!ID_user || !Show_secheduld || !Poster || !Name || !LineUP || !Con_type || !Pre_date || !Quantity_date || !Address || !Detail || !Per_type) {
        console.log('Validation failed:', { ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Pre_date, Quantity_date, Address, Detail, Per_type });
        return res.status(400).send('All fields are required.');
    }

    try {
        const request = new sql.Request();
        
        // Set parameters for SQL query
        request.input('ID_user', sql.Int, ID_user);
        request.input('Show_secheduld', sql.VarChar, Show_secheduld);
        request.input('Poster', sql.VarChar, Poster);
        request.input('Name', sql.VarChar, Name);
        request.input('LineUP', sql.Text, LineUP);
        request.input('Con_type', sql.Int, Con_type);
        request.input('Pre_date', sql.VarChar, Pre_date);
        request.input('Quantity_date', sql.Int, Quantity_date);
        request.input('Address', sql.VarChar, Address);
        request.input('Detail', sql.Text, Detail);
        request.input('Per_type', sql.Int, Per_type);

        // SQL query to insert data into Concerts table
        const query = `
            INSERT INTO Concerts (ID_user, Show_secheduld, Poster, Name, LineUP, Con_type, Pre_date, Quantity_date, Address, Detail, Per_type)
            VALUES (@ID_user, @Show_secheduld, @Poster, @Name, @LineUP, @Con_type, @Pre_date, @Quantity_date, @Address, @Detail, @Per_type);
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
            SELECT ID_Type_Show, NameTS
            FROM TypeShow
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
            UPDATE RoomStatus
            SET NameRS = ${NameRS}
            WHERE ID_Room_Status = ${id}
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
            DELETE FROM RoomStatus
            WHERE ID_Room_Status = ${id}
            AND ID_Room_Status NOT IN (1, 2, 3, 4);
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
            UPDATE TypeConcert
            SET NameTC = ${NameTC}
            WHERE ID_Type_Con = ${id}
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
            DELETE FROM TypeConcert
            WHERE ID_Type_Con = ${id}
            AND ID_Type_Con NOT IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,21,23,24,25,26,27,28);
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
            UPDATE TypeShow
            SET NameTS = ${NameTS}
            WHERE ID_Type_Show = ${id}
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
            DELETE FROM TypeShow
            WHERE ID_Type_Show = ${id}
            AND ID_Type_Show NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ,11);
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
            UPDATE TypeTicket
            SET NameT = ${NameT}
            WHERE TID = ${id}
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
            DELETE FROM TypeTicket
            WHERE TID = ${id}
            AND TID NOT IN (1, 2, 3);
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
            UPDATE TypeHotel
            SET NameTH = ${NameTH}
            WHERE ID_Type_Hotel = ${id}
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
            DELETE FROM TypeHotel
            WHERE ID_Type_Hotel = ${id}
            AND ID_Type_Hotel NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
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
            UPDATE TypeRoom
            SET NameTR = ${NameTR}
            WHERE ID_Type_Room = ${id}
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
            DELETE FROM TypeRoom
            WHERE ID_Type_Room = ${id}
            AND ID_Type_Room NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
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
            UPDATE TypeView
            SET NameTV = ${NameTV}
            WHERE ID_Type_Room = ${id}
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
            DELETE FROM TypeView
            WHERE ID_Type_Room = ${id}
            AND ID_Type_Room NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
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
            DELETE FROM OfferStatus
            WHERE ID_Offer_Status = ${id}
            AND ID_Offer_Status NOT IN (1, 2, 3);
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
            SELECT RoomHotel.ID_room, NameTR, NameTV, NameRS, PriceH
            FROM RoomHotel
            JOIN TypeRoom ON RoomHotel.Type_room = TypeRoom.ID_Type_Room
            JOIN TypeView ON RoomHotel.Type_view = TypeView.ID_Type_Room
            JOIN RoomStatus ON RoomHotel.Status_room = RoomStatus.ID_Room_Status
            WHERE RoomHotel.ID_hotel = ${ID_hotel}
            GROUP BY  RoomHotel.ID_room,NameTR, NameTV, NameRS, PriceH
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
            SELECT ID_room, Img_Url_room
            FROM RoomlPicture
            WHERE ID_room = ${ID_room}
            GROUP BY ID_room, Img_Url_room
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

        const request1 = new sql.Request(transaction);
        await request1.input('ID_room', sql.Int, ID_room)
            .query('DELETE FROM RoomlPicture WHERE ID_room = @ID_room');

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



// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

