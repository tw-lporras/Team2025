
# Twilio Serverless Package: Agent Handoff: Taskrouter Enqueue

Use this package locally ( or deploy via Twlio CLI ) to work facilitate handoff of the customer voice call from Conversation Relay to Flex.

### Prerequisites

1. Install [Twilio CLI](https://www.twilio.com/docs/twilio-cli/getting-started/install)
2. Install CLI [Serverless Toolkit](https://www.twilio.com/docs/labs/serverless-toolkit/getting-started)
3. Create a CLI [account profile](https://www.twilio.com/docs/twilio-cli/general-usage/profiles)
4. Set the CLI account profile (Step 3) as [active](https://www.twilio.com/docs/twilio-cli/general-usage/profiles#set-an-active-profile)

### Setup and Configuration

Follow these steps to configure and test locally

### Configure Environment (.env)

Make a copy of the example .env ( .env.example ) file

```sh
cd convRelayApp/serverless-cr
mkcopy .env.example .env
```

### Configure the ENV file

Within the .env file configure the environmental constants ( accountSid, authToken, taskrouter_workflow_sid).

### Build package dependencies

```sh
npm i
```

### Start Serverless package locally

Using Visual Studio Code, open a new terminal window and start the serverless package locally.
By default this will load on port 3000.

> NOTE: This function process should be launched on port 3001.  

```sh
cd serverless
twilio serverless:start
```

### Deploy to Twilio Cloud
Follow the Twilio Serverless Toolkit docs to deploy this Twilio Serverless package to your
Twilio Account. 