# Boost high performance&concurrency network server using event-loop model

Today in internet world, a common technology challenge we are facing in network server scalability is how to ensure that the server handles a large number of connections simultaneously with a high performance. Explorer the excellent network server designs and implementations, the event-loop programming model seems usually take a key role in this area. Why? What underlying story is? I would like to jot down this writing which came cross with my earlier experiences/research as a future reference for me and any one who come across to this post. 

~~~
TO-DELETE:

Note: structure reference: https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/
http://www.wangafu.net/~nickm/libevent-book/Ref0_meta.html
(ref: book: unix network programming chapter 6)Before describing select and poll, we need to step back and look at the bigger picture,
examining the basic differences in the five I/O models that are available to us under Unix:
blocking I/O
nonblocking I/O
(busy poll , the bad sample , http://www.wangafu.net/~nickm/libevent-book/01_intro.html)
I/O multiplexing (select and poll)
signal driven
(SIGIO)
Table of I/O
Contents
•
UNIX® Network Programming Volume 1, Third Edition: The Sockets Networking
API
asynchronous I/O (the POSIX aio_functions)
By W. Richard Stevens , Bill Fenner , Andrew M. Rudoff
You may want to skim this section on your first reading and then refer back to it as you
encounter the different I/O models described in more detail in later chapters.
Publisher: Addison Wesley
As we show in all the examples in this section, ....

There is a very good article talking about POXIS AIO API, but If you were reading http://www.ibm.com/developerworks/linux/library/l-async/ , you may feel confusing.. Many years ago, when I first time read that doc, I also feel confusing, but I realized at that time Tim's asyn does not same as the book above.....
~~~

Before jumping into event-loop programming model, let's step back and take a look at the bigger picture, exploring the differences among these typical and classic I/O models under unix-like operating system as well as the appropriate programming models which fit in these I/O models.

## I/O models under unix-like OS



### Blocking I/O
One of the most common models is the synchronous blocking I/O model. In this model, the user-space application performs a system call that results in the application blocking. This means that the application blocks entirely until the system call is complete (e.g: process calls recvfrom, data is transferred from kernel buffer to user space buffer or error reported)

~~~
TODO, diagram
~~~

We use UDP for example, the process calls recvfrom and the system call does not return until the datagram arrives and is transferred from kernel buffer into our user space buffer, or an error occurs. We say that our process is blocked the entire time from when it calls recvfrom until it returns. When recvfrom returns successfully, our application continue processing the datagram. Imaging that we need to write a program to handle multiple connections at once, we almost no choice but fall into thread-per-connection programming model. We will talk about this programming model later with more details.

### Non-blocking I/O
When we set a socket to be nonblocking, we are telling the kernel "when an I/O operation
that I request cannot be completed without putting the process to sleep, do not put the
process to sleep, but return an error instead.
~~~
TODO, diagram
~~~
In this model, a device is opened as non-blocking. This means that instead of completing an I/O immediately, a read may return an error code indicating that the command could not be immediately satisfied (EAGAIN or EWOULDBLOCK), as shown in Figure 3.The implication of non-blocking is that an I/O command may not be satisfied immediately, requiring that the application make numerous calls to await completion. This can be extremely inefficient because in many cases the application must busy-wait until the data is available or attempt to do other work while the command is performed in the kernel. As also shown in Figure 3, this method can introduce latency in the I/O because any gap between the data becoming available in the kernel and the user calling read to return it can reduce the overall data throughput.

### I/O multiplexing

What is Multiplex? 

~~~
TODO, diagram
~~~
### Signal driven I/O

~~~
TODO, diagram
~~~
### Asynchronous I/O

~~~
TODO, diagram
~~~

~~~
We have explorered  5 typical I/O models under unix-like OS with examples 
from operating system level, which explain the asynchronous and synchronous 
behaviors from the perspective of user space and kernel space. Actually, 
the two terms can also be adopted to higher level programming languages. 
Just keep in mind, for asynchronous I/O model, after we make the call on 
the I/O facility, the process will not in pending status, once the response 
arrive, the data gram will be transferred by underlying system component 
on background and a completion event which carrying response/error should be notified to process.
~~~

>  Note: Tim Jonh's has written a very good article to explain the usage of POSIX AIO API(see reference [[1]](http://www.ibm.com/developerworks/linux/library/l-async/)), I like that article very much in general, but if the terminology of "asynchronous" can align with POSIX definition, that would be perfect.

```
TO-DELETE
      Before we just into the docment, let's clarify some I/O pattern concepts. Thoese are really important for us to understand the whole articles.
      
      Blocking 
      non-blocking
      Sync
      Async

      Blocking and non-blocking is defined from API usage perspective,
      Sync and Async is defined from how the result get back to caller.
      Those patterns are common pattern and adopt to different level, so if we talking about these concept, please make sure we are talking on the same layer of things, e.g: are you talking about OS kernel, or some API or lib provided by a language.
      
      E.g: Netty is a async IO framework, from the Netty API, it is a non-blocking ASync IO, but if we look into the implmentation, it actually based on Java NIO, the Java NIO on linux actually is based on epoll, that is a sync-multiplexing technology, it is not a AIO from kernel perspective. anyway, when we talk about IO pattern, we need to know what layer we are talking about, In a reality, some thread-model can convert a non-block sync IO to a non-blocking async IO...
```
 ## Key words
       Blocking, 
       non-blocking, 
       Sync
       Async
 
 ## Programming Models(is is good to mentioned here, maybe better to introduced this in the place which use it, e.g: problem section to explain thread-based pattern, C10K solution to describe the others two pattern)
### Thread-Based Pattern
### Reactor Pattern, both model(2) and mode(3) can be mapped to this pattern, but model(2)  is extremely inefficient because in many cases the application must busy-wait until the data is available or attempt to do other work while the command is perform
### Proactor Pattern
       
      
## Thread-Based Model(a.k.a thread-per-connection)
    the Apache, requer per thread hit the big problem, CPU is more and more faster than IO, waste CPU time to wait for IO response is not good, and with the request increasing, the thread/process context switch is more and more expensive. also each thread will take memory... all of these bring us to think about an other direction to resolve the problem.
    Diagram of :Apache solution for high perfmance -- request per thread
    
    This model actually is mapped to the IO pattern -- Blocking Pattern
    
## Recap C10K problem 
     15 Years ago, xxx arise C10K problem which was a big chellenge( This situation is often called the c10k problem. With select() or poll(), your network server will hardly perform any useful things but wasting precious CPU cycles under such high load.
 http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html
 file:///home/lizh/materials/studyplan/Nginx/%E6%9E%B6%E6%9E%84%E5%B8%88%E5%AE%9E%E8%B7%B5%E6%97%A5%EF%BD%9C%E4%BB%8EC10K%E5%88%B0C10M%E9%AB%98%E6%80%A7%E8%83%BD%E7%BD%91%E7%BB%9C%E7%9A%84%E6%8E%A2%E7%B4%A2%E4%B8%8E%E5%AE%9E%E8%B7%B5%C2%A0%20_%20%E4%B8%83%E7%89%9B%E4%BA%91%E5%AD%98%E5%82%A8.html)... the solution:
     Reactor Pattern and Proactor Pattern
     Explain reactor apttern and proactor pattern:
     
     reactor pattern diagram (http://gngrwzrd.com/libgwrl/pod.html#reactor_pattern)
     
     proactor pattern diagram(https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/)
     
     Those two pattern actually mapped to the two I/O pattern:
     
    non-blocking sync IO: two things are quit important for this pattern:
        non-blocking and multiplexing
        
        explain what is multiplexing(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
    
    non-blocking async IO
    
    Let's explorer the situations from kernel and programming language..
    
   ## Linux Kernel Support
   ### noblocking
   http://www.wangafu.net/~nickm/libevent-book/01_intro.html
   ### AIO
     In Linux, the real AIO actually is supported only on Disk IO, (
     http://lse.sourceforge.net/io/aio.html, (the real kernal aio, but not support socket)
     http://www.bullopensource.org/posix/ (not good at performance, it actually add a thread-mode in user-space, underearth, it still call the blocking system api)
     http://man7.org/linux/man-pages/man7/aio.7.html(The current Linux POSIX AIO implementation is provided in user space
       by glibc.  This has a number of limitations, most notably that
       maintaining multiple threads to perform I/O operations is expensive
       and scales poorly)
     http://stackoverflow.com/questions/8768083/difference-between-posix-aio-and-libaio-on-linux
     https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/ 
     The situation for the AIO mode however is bit different at least in the Linux
case. The aio support for sockets in Linux seems to be shady at best with some
suggesting it is actually using readiness events at kernel level while providing
an asynchronous abstraction on completion events at application level. However
Windows seems to support this first class again via “I/O Completion Ports”.)Poxis AIO actually introduced thread model, not a real AIO supported from kernel level. For Network IO, we only have non-blocking IO. 
     How can we achieve I/O multiplexing without thread-per-connection? You can simply do busy-wait polling for each connection with non-blocking socket operations, but this is too wasteful. What we need to know is which socket becomes ready. So the OS kernel provides a separate channel between your application and the kernel, and this channel notifies when some of your sockets become ready. This is how select()/poll() works, based on the readiness model. (http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     In Linux, for network, we only have multiplux way,  to implement non-blocking and sync IO, OS need provide two things:
     non-blocking socket, with this non-blocking socket, the caller thread can continue do some other things, in order to map the socket response to approparite socket client, a selector is needed here to do the mapping, once there is "readiness" event ready, and caller thread to pick that event up and do the corresponding actions on correct socket. This is IO multipluxer(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html what is multiplux)
    
  ### multiplux
     Explain what is multiplux(diagram file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     select, poll, epoll(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     
     Select:
     
     Poll:
     
     Epoll: 
     
     Epoll was introduced by a paper, explain a little bit about that paper(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     http://blog.csdn.net/zys85/article/details/3710579
     http://it.taocms.org/12/6246.htm
     http://slidedeck.io/donatasm/hacking-an-nginx-module
     Give a timeline of select --> poll --> paper -->epoll(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html, file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     Give a chart about how epoll improve the perf so much
     (file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     Epoll is so important, explain a little bit more about the two work mode: LT和ET的区别(http://m.blog.csdn.net/article/details?id=39895449, http://www.ccvita.com/515.html)
     
     Select Vs poll Vs Epoll (http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)
     
     Time Complexity: (http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)
     
 ## Event Loop Programming Model(The Bridge of From Reactor Pattern to Proactor pattern) 
 Even we have reactor pattern, it is still hard for programmer to write a good performance server, because this require developer have a deep understand about the thread-safe on the language and lower level OS technology, if not, reactor pattern may have result a regresson server than thread-mode  
 Alought OS kernel did not provide us a easy to do this, smarter programmer never give up the effort to figure out a way  move to Proactor pattern on Reactor pattern, the answer is yes, we can 封装 a thread-mode to adopt the reactor pattern to proactor pattern, the answer is event-loop mode
 
 Please keep in mind, the event-loop mode we mentioned in this article is specific to IO event-loop, not a general event loop, as event loop mode actually is also used widely in the GUI world, e.g: user click mouse on a button, and move a window from one area to an other...
 
 
 event_loop, the result will be callback to caller, it usually come together with a well thread-model implementation
 
 what is event loop(https://seanlin0800.gitbooks.io/async-performance/content/source/ch1/event_loop.html, http://blog.jobbole.com/50138/)

### Tick
explain what is tick in event loop programming model
http://stackoverflow.com/questions/19822668/what-exactly-is-a-node-js-event-loop-tick
 
 ## Event-loop based I/O framework across different programming languages
 ### C programming language:
 Nginx: event mode(file:///home/lizh/materials/studyplan/Nginx/ReadyState4%20%C2%BB%20Blog%20Archive%20%C2%BB%20Nginx,%20the%20non-blocking%20model,%20and%20why%20Apache%20sucks.html)
 event module: http://www.cnblogs.com/fll369/archive/2012/11/29/2794939.html
 http://nginx-book.readthedocs.io/en/latest/chapter_06.html#event-40
 https://www.nginx.com/blog/thread-pools-boost-performance-9x/ (event loop and thread based event loop)
  http://slidedeck.io/donatasm/hacking-an-nginx-module (master and worker has their individual event loop)
  http://www.aosabook.org/en/nginx.html (nginx uses multiplexing and event notifications heavily,Aimed at solving the C10K problem of 10,000 simultaneous connections, nginx was written with a different architecture in mind—one which is much more suitable for nonlinear scalability in both the number of simultaneous connections and requests per second. nginx is event-based, so it does not follow Apache's style of spawning new processes or threads for each web page request. The end result is that even as load increases, memory and CPU usage remain manageable. nginx can now deliver tens of thousands of concurrent connections on a server with typical hardware.)
  https://dzone.com/articles/inside-nginx-how-we-designed
  http://www.xxbar.net/thread-854661-1-1.html(nginx use linux kernel aio for file access if compile with a specific tag)
  http://www.infoq.com/cn/articles/thread-pools-boost-performance-9x
  一些操作系统为读写文件提供了异步接口，NGINX可以使用这样的接口（见AIO指令）。FreeBSD就是个很好的例子。不幸的是，我们不能在Linux上得到相同的福利。虽然Linux为读取文件提供了一种异步接口，但是存在明显的缺点。其中之一是要求文件访问和缓冲要对齐，但NGINX很好地处理了这个问题。但是，另一个缺点更糟糕。异步接口要求文件描述符中要设置O_DIRECT标记，就是说任何对文件的访问都将绕过内存中的缓存，这增加了磁盘的负载。在很多场景中，这都绝对不是最佳选择。
 Libevent
 https://zhuanlan.zhihu.com/p/20315482
 Libev
 Libuv(https://nikhilm.github.io/uvbook/basics.html#event-loops)
 
 ### Java programming language:
 Netty:
 
    Event-Loop(Thread mode) + ChannelPipleline(Extensible event handling framework)
    
    A diagram:
    
              Netty     ---> (eventloop + channelpipleline, async pattern)
              jvm(NIO)  ---> (selector)
              os(epoll) ---> (sync-demultipluxer(selector))
    From 3.x to 4.x, Netty get back to singlethread strategy for the thread-mode, because a good framework should know who important it is to reduce the complexicity for the end user. If each channel(connection) still can switch among different threads, that somewhat take programmer back to the bare reactor pattern, that is a regression from end user experience perspective.
    
    Explain about event-loop in netty , channelpipeline in netty with diagram
    
 ### Node.js:
 
 Diagram about how nodejs works
 (http://www.ruanyifeng.com/blog/2014/10/event-loop.html)
 
 (alternative begin: https://vimeo.com/96425312 Us JavaScript programmers like to use words like, "event-loop", "non-blocking", "callback", "asynchronous", "single-threaded" and "concurrency".

We say things like "don't block the event loop", "make sure your code runs at 60 frames-per-second", "well of course, it won't work, that function is an asynchronous callback!"

If you're anything like me, you nod and agree, as if it's all obvious, even though you don't actually know what the words mean; and yet, finding good explanations of how JavaScript actually _works_ isn't all that easy, so let's learn!

With some handy visualisations, and fun hacks, let's get an intuitive understanding of what happens when JavaScript runs. Beginner or veteran, I'm sure you'll learn something!)
 
 ## Is event-loop model the ONLY approach to resolve the problem? 
 Of course not, the event loop mode actually is on the way of use less thread to service more connection. In an other hand, erlang and golang are resolving the problem by making a lightweight "green-thread" to archive the same goal. and also do this very well in their direction.
 http://demo.netfoucs.com/jiao_fuyou/article/details/36010691
    
    
## Wrap up

IO Pattern:         Blocking and Sync ---> non-blocking Sync --> non-blocking async
    OS(kernel):                            non-blocking socket           AIO
                                              multipulex(epoll)
Programming Model:                             Java NIO      --(event-loop)---->   Netty
                                                 C-------------event-module--------> Nginx
                                                 JS             (libuv)         ---> node.js
                                                 
                                                 
             IO Pattern           BLocking and Sync -->(kernel) -->   NIO      Async IO
             
## References
[1] http://www.ibm.com/developerworks/linux/library/l-async/
                              
     
     
