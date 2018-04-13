// /**
//  * Tests for amqp-ts
//  * Created by Ab on 2015-09-16.
//  */
// import * as Chai from "chai";
// var expect = Chai.expect;

// import * as Amqp from "amqp-ts";

// /**
//  * Until we get a good mock for amqplib we will test using a local rabbitmq instance
//  */
// // define test defaults
// var ConnectionUrl = process.env.AMQP_SRC_CONNECTION_URL || "amqp://localhost";
// var UnitTestTimeout = process.env.AMQPTEST_TIMEOUT || 1500;
// var LogLevel = process.env.AMQPTEST_LOGLEVEL || "critical";
// var testExchangeNamePrefix = process.env.AMQPTEST_EXCHANGE_PREFIX || "TestExchange_";
// var testQueueNamePrefix = process.env.AMQPTEST_QUEUE_PREFIX || "TestQueue_";

// // set logging level
// Amqp.log.transports.console.level = LogLevel;

// /* istanbul ignore next */
// describe("Test amqp-e2e module", function () {
//   this.timeout(UnitTestTimeout); // define default timeout

//   // create unique queues and exchanges for each test so they do not interfere with each other
//   var testExchangeNumber = 0;
//   function nextExchangeName(): string {
//     testExchangeNumber++;
//     return testExchangeNamePrefix + testExchangeNumber;
//   }
//   var testQueueNumber = 0;
//   function nextQueueName(): string {
//     testQueueNumber++;
//     return testQueueNamePrefix + testQueueNumber;
//   }

//   // keep track of the created connections for cleanup
//   var connections: Amqp.Connection[] = [];
//   function getAmqpConnection() {
//     var conn = new Amqp.Connection(ConnectionUrl, {}, { retries: 5, interval: 1500 });
//     connections.push(conn);
//     return conn;
//   }

//   // cleanup failed tests
//   // unfortunately does still not execute after encountering an error in mocha, perhaps in future versions
//   // function after(done) {
//   //   var processAll: Promise<any>[] = [];
//   //   console.log("cleanup phase!");
//   //   for (var i = 0, l = connections.length; i < l; i++) {
//   //     processAll.push(connections[i].deleteConfiguration());
//   //   }
//   //   Promise.all(processAll).then(() => {
//   //     done();
//   //   }).catch((err) => {
//   //     done(err);
//   //   });
//   // }

//   // cleanup function for the AMQP connection, also tests the Connection.deleteConfiguration method
//   function cleanup(connection, done, error?) {
//     connection.deleteConfiguration().then(() => {
//       return connection.close();
//     }).then(() => {
//       done(error);
//     }, (err) => {
//       done(err);
//     });
//   }

//   describe("AMQP Connection class initialization", function () {
//     it("should create a RabbitMQ connection", function (done) {
//       // test code
//       var connection = getAmqpConnection();
//       // check result
//       connection.initialized
//         .then(() => { // successfully create the AMQP connection
//           connection.close().then(() => { // successfully close the AMQP connection
//             done();
//           });
//         })
//         .catch(() => { // failed to create the AMQP connection
//           done(new Error("Failed to create a new AMQP Connection."));
//         });
//     });
//   });
// });
