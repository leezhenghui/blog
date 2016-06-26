# High Performance and High Concurrency Server With Event Loop Model

Note: structure reference: https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/

## IO Patterns
      Before we just into the docment, let's clarify some IO pattern concepts. Thoese are really important for us to understand the whole articles.
      
      Blocking 
      non-blocking
      Sync
      Async

      Blocking and non-blocking is defined from API usage perspective,
      Sync and Async is defined from how the result get back to caller.
      Those patterns are common pattern and adopt to different level, so if we talking about these concept, please make sure we are talking on the same layer of things, e.g: are you talking about OS kernel, or some API or lib provided by a language.
      
      E.g: Netty is a async IO framework, from the Netty API, it is a non-blocking ASync IO, but if we look into the implmentation, it actually based on Java NIO, the Java NIO on linux actually is based on epoll, that is a sync-multiplexing technology, it is not a AIO from kernel perspective. anyway, when we talk about IO pattern, we need to know what layer we are talking about, In a reality, some thread-model can convert a non-block sync IO to a non-blocking async IO...
      
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
    
   ## Operating System(OS)
     In Linux, the real AIO actually is supported only on Disk IO, Poxis AIO actually introduced thread model, not a real AIO supported from kernel level. For Network IO, we only have non-blocking IO. 
     How can we achieve I/O multiplexing without thread-per-connection? You can simply do busy-wait polling for each connection with non-blocking socket operations, but this is too wasteful. What we need to know is which socket becomes ready. So the OS kernel provides a separate channel between your application and the kernel, and this channel notifies when some of your sockets become ready. This is how select()/poll() works, based on the readiness model. (http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     In Linux, for network, we only have multiplux way,  to implement non-blocking and sync IO, OS need provide two things:
     non-blocking socket, with this non-blocking socket, the caller thread can continue do some other things, in order to map the socket response to approparite socket client, a selector is needed here to do the mapping, once there is "readiness" event ready, and caller thread to pick that event up and do the corresponding actions on correct socket. This is IO multipluxer(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html what is multiplux)
    
  ### Linux Kernel
     Explain what is multiplux(diagram file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     select, poll, epoll(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     
     Select:
     
     Poll:
     
     Epoll: 
     
     Epoll was introduced by a paper, explain a little bit about that paper(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     
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
 
 
 event_loop, the result will be callback to caller
 
 what is event loop(https://seanlin0800.gitbooks.io/async-performance/content/source/ch1/event_loop.html)
 
 ## C programming language:
 Nginx: event mode(file:///home/lizh/materials/studyplan/Nginx/ReadyState4%20%C2%BB%20Blog%20Archive%20%C2%BB%20Nginx,%20the%20non-blocking%20model,%20and%20why%20Apache%20sucks.html)
 
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
 
 
 ## Is event-loop mode the ONLY approach to resolve the problem? 
 Of course not, the event loop mode actually is on the way of use less thread to service more connection. In an other hand, erlang and golang are resolving the problem by making a lightweight "green-thread" to archive the same goal. and also do this very well in their direction.
    
    
## Wrap up

IO Pattern:         Blocking and Sync ---> non-blocking Sync --> non-blocking async
    OS(kernel):                            non-blocking socket           AIO
                                              multipulex(epoll)
Programming Model:                             Java NIO      --(event-loop)---->   Netty
                                                 C-------------event-module--------> Nginx
                                                 JS             (libuv)         ---> node.js
                                                 
                                                 
             IO Pattern           BLocking and Sync -->(kernel) -->   NIO      Async IO
                              
     
     