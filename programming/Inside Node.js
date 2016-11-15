Inside Node.js

https://blog.ghaiklor.com/how-nodejs-works-bfe09efc80ca#.j6vk1imx5

	从技术角度由远及近的研究，

	第一步，我们看如何embed v8 into C++ application

	https://github.com/v8/v8/wiki

		1. sync code 

		cd /home/lizh/playground/JS

		Download depot_tools
		gclient
		fetch v8

		gclient sync

		https://github.com/v8/v8/wiki/Using%20Git#how-to-start

			2. build

			cd /home/lizh/playground/JS/v8
			make x64.release

			3. sample
			https://www.ibm.com/developerworks/cn/opensource/os-cn-v8engine/#download
				v8 built-in sample shell for more details

				第二步，如何集成http-parser and libev成为一个high perf web server

				第三步， 初期的libuv, thing wrapper on libev

				第三步 如何扩展v8，提供新的 JS API

				第四步 如何打通v8和libuv

				第五步 如何为node.js提供user land addon 
