# xpush-chat

xpush-chat run on the basis of [XPUSH (eXtensional PUSH)](https://github.com/xpush/node-xpush)

## 1. Prepare

### mongodb
Install and run mongodb with reference [MongoDB installation](http://docs.mongodb.org/manual/administration/install-on-linux/).

The follow is the code to install and run redis 3.0.3. (in unbuntu 14.04)

	cd $HOME/xpush
	wget https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu1404-3.0.6.tgz
	tar xzf mongodb-linux-x86_64-ubuntu1404-3.0.6.tgz
	mv mongodb-linux-x86_64-ubuntu1404-3.0.6 mongodb	
	cd mongodb
	mkdir data
<p/>
	bin/mongod --dbpath=./data

## 2. Install

	git clone https://github.com/xpush/xpush-chat.git
	npm install	

## 3. Create config file of xpush-chat

#### config.json
        
	{
          // Your zookeeper address
	  "zookeeper": {"address":"127.0.0.1:2181"},
          // Your redis address
	  "redis": {"address":"127.0.0.1:6379"},
          // Your mongo db address
	  "mongodb": {"address":"127.0.0.1:27017"}
  	}

## 4. Run your application with push module

### run session server with config file

	bin/session-server --host 54.178.160.166 --config ~/config/config.json --port 8000
	
### run channel server

	bin/channel-server --host 54.178.160.166 --config ~/config/config.json --port 8080
