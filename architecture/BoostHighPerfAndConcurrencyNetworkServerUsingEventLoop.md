# Boost high performance&concurrency network server using event-loop model

Note: structure reference: https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/

(ref: book: unix network programming chapter 6)Before describing select and poll, we need to step back and look at the bigger picture,
examining the basic differences in the five I/O models that are available to us under Unix:
blocking I/O
nonblocking I/O
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

## Concepts 
### Classic Unix IO Models
      Before we just into the docment, let's clarify some IO pattern concepts. Thoese are really important for us to understand the whole articles.
      
      Blocking 
      non-blocking
      Sync
      Async

      Blocking and non-blocking is defined from API usage perspective,
      Sync and Async is defined from how the result get back to caller.
      Those patterns are common pattern and adopt to different level, so if we talking about these concept, please make sure we are talking on the same layer of things, e.g: are you talking about OS kernel, or some API or lib provided by a language.
      
      E.g: Netty is a async IO framework, from the Netty API, it is a non-blocking ASync IO, but if we look into the implmentation, it actually based on Java NIO, the Java NIO on linux actually is based on epoll, that is a sync-multiplexing technology, it is not a AIO from kernel perspective. anyway, when we talk about IO pattern, we need to know what layer we are talking about, In a reality, some thread-model can convert a non-block sync IO to a non-blocking async IO...
 ### Key words
       Blocking, 
       non-blocking, 
       Sync
       Async
 
 ### IO Patterns (is is good to mentioned here, maybe better to introduced this in the place which use it, e.g: problem section to explain thread-based pattern, C10K solution to describe the others two pattern)
 ### Programming Models
       Thread-Based Pattern
       Reactor Pattern, both model(2) and mode(3) can be mapped to this pattern, but model(2)  is extremely inefficient because in many cases the application must busy-wait until the data is available or attempt to do other work while the command is perform
       Proactor Pattern
       
      
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
     
     Those two pattern actually mapped to the two IO pattern:
     
    non-blocking sync IO: two things are quit important for this pattern:
        non-blocking and multiplexing
        
        explain what is multiplexing(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
    
    non-blocking async IO
    
   ## Linux Kernel Support
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
     http://slidedeck.io/donatasm/hacking-an-nginx-module
     Give a timeline of select --> poll --> paper -->epoll(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html, file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     Give a chart about how epoll improve the perf so much
     (file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     Epoll is so important, explain a little bit more about the two work mode: LT和ET的区别(http://m.blog.csdn.net/article/details?id=39895449, http://www.ccvita.com/515.html)
     
     Select Vs poll Vs Epoll (http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)
     
     Time Complexity: (http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)
     
 ## Event Loop Model(Bridge of From Reactor Pattern to Proactor pattern) 
 Even we have reactor pattern, it is still hard for programmer to write a good performance server, because this require developer have a deep understand about the thread-safe on the language and lower level OS technology, if not, reactor pattern may have result a regresson server than thread-mode  
 Alought OS kernel did not provide us a easy to do this, smarter programmer never give up the effort to figure out a way  move to Proactor pattern on Reactor pattern, the answer is yes, we can 封装 a thread-mode to adopt the reactor pattern to proactor pattern, the answer is event-loop mode
 
 Please keep in mind, the event-loop mode we mentioned in this article is specific to IO event-loop, not a general event loop, as event loop mode actually is also used widely in the GUI world, e.g: user click mouse on a button, and move a window from one area to an other...
 
 
 event_loop, the result will be callback to caller, it usually come togegher with a well thread-model implementation
 
 what is event loop(https://seanlin0800.gitbooks.io/async-performance/content/source/ch1/event_loop.html)

### Tick
explain what is tick
 
 ## C programming language:
 Nginx: event mode(file:///home/lizh/materials/studyplan/Nginx/ReadyState4%20%C2%BB%20Blog%20Archive%20%C2%BB%20Nginx,%20the%20non-blocking%20model,%20and%20why%20Apache%20sucks.html)
 https://www.nginx.com/blog/thread-pools-boost-performance-9x/ (event loop and thread based event loop)
  http://slidedeck.io/donatasm/hacking-an-nginx-module (master and worker has their individual event loop)
  http://www.aosabook.org/en/nginx.html
  https://dzone.com/articles/inside-nginx-how-we-designed
 Libevent
 Libev
 Libuv(https://nikhilm.github.io/uvbook/basics.html#event-loops)
 
 ## Java programming language:
 Netty:
 
    Event-Loop(Thread mode) + ChannelPipleline(Extensible event handling framework)
    
    A diagram:
    
              Netty     ---> (eventloop + channelpipleline, async pattern)
              jvm(NIO)  ---> (selector)
              os(epoll) ---> (sync-demultipluxer(selector))
    From 3.x to 4.x, Netty get back to singlethread strategy for the thread-mode, because a good framework should know who important it is to reduce the complexicity for the end user. If each channel(connection) still can switch among different threads, that somewhat take programmer back to the bare reactor pattern, that is a regression from end user experience perspective.
    
    Explain about event-loop in netty , channelpipeline in netty with diagram
    
 ## Node.js:
 
 Diagram about how nodejs works
 (http://www.ruanyifeng.com/blog/2014/10/event-loop.html)
 
 (alternative begin: https://vimeo.com/96425312 Us JavaScript programmers like to use words like, "event-loop", "non-blocking", "callback", "asynchronous", "single-threaded" and "concurrency".

We say things like "don't block the event loop", "make sure your code runs at 60 frames-per-second", "well of course, it won't work, that function is an asynchronous callback!"

If you're anything like me, you nod and agree, as if it's all obvious, even though you don't actually know what the words mean; and yet, finding good explanations of how JavaScript actually _works_ isn't all that easy, so let's learn!

With some handy visualisations, and fun hacks, let's get an intuitive understanding of what happens when JavaScript runs. Beginner or veteran, I'm sure you'll learn something!)
 
 ## Is event-loop model the ONLY approach to resolve the problem? 
 Of course not, the event loop mode actually is on the way of use less thread to service more connection. In an other hand, erlang and golang are resolving the problem by making a lightweight "green-thread" to archive the same goal. and also do this very well in their direction.
    
    
## Wrap up

IO Pattern:         Blocking and Sync ---> non-blocking Sync --> non-blocking async
    OS(kernel):                            non-blocking socket           AIO
                                              multipulex(epoll)
Programming Model:                             Java NIO      --(event-loop)---->   Netty
                                                 C-------------event-module--------> Nginx
                                                 JS             (libuv)         ---> node.js
                                                 
                                                 
             IO Pattern           BLocking and Sync -->(kernel) -->   NIO      Async IO
             
## References

                              
     
     