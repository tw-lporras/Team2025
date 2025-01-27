const { Analytics } = require('@segment/analytics-node')
require('dotenv').config();
const axios = require('axios');

const profileToken = process.env.PROFILE_TOKEN;

// instantiation
const analytics = new Analytics({ writeKey: process.env.WRITE_KEY });

const spaceID = process.env.SPACE_ID;

function getProfile(id) {
  const username = profileToken;
  const password = '';
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');

  const config = {
      headers: {
          Authorization: `Basic ${credentials}`,
      },
  };

  console.log('get_profile from segment for id: ' + id);

  // Return the axios Promise
  return axios
      .get(`https://profiles.segment.com/v1/spaces/${spaceID}/collections/users/profiles/phone:${id}/traits`, config)
      .then(response => {
          const traits = response.data.traits;
          console.log(traits);
          return traits; // Return the traits so it can be awaited
      })
      .catch(error => {
          console.error('get_profile error:', error);
          return ''; // Return an empty string or handle errors appropriately
      });
}

function getEvents(id) {
  const username = profileToken;
  const password = '';
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');

  const config = {
      headers: {
          Authorization: `Basic ${credentials}`,
      },
  };

  console.log('get_events from segment for id: ' + id);

  // Return the axios Promise
  return axios
      .get(`https://profiles.segment.com/v1/spaces/${spaceID}/collections/users/profiles/phone:${id}/events`, config)
      .then(response => {
          console.log('Events data:', response.data);
          return response.data; // Return the events data so it can be awaited
      })
      .catch(error => {
          console.error('get_events error:', error);
          return []; // Return an empty array or handle errors appropriately
      });
}

function readData(jsonData){
  

  try {
    
    const result = [];
    
    jsonData.data.forEach(item => {
        
        const extractedData = {
            timestamp: item.properties.timestamp,
            order: item.properties.order,
            // orderID:item.properties.orderID,
            price: item.properties.price,
            shippingMethod: item.properties.shippingMethod
        };
        
        result.push(extractedData);
    });
    
    
    console.log(result);
  } catch (error) {
    console.error('Error parsing JSON data:', error);
  }


}

module.exports = { getEvents, getProfile }; // Named exports


// addUser('8967', 'john black', '+491234567', 'Berlin Germany');

// addEvent('8967', '2024-10-22', 'Medium eggplant pizza with sausages and AI sauce', 13, 'Delivery');

// getEvents('8967');

//getProfile('8967');
