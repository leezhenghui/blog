#High Performance and High Concurrency Server With Event Loop Model

Note: structure reference: https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/

## IO Patterns
      Blocking 
      non-blocking
      Sync
      Async

      Blocking and non-blocking is defined from API usage perspective,
      Sync and Async is defined from how the result get back to caller.
      Those patterns are common pattern and adopt to different level, so if we talking about these concept, please make sure we are talking on the same layer of things, e.g: are you talking about OS kernel, or some API or lib provided by a language.
      
## Thread-Based Model
    the Apache, requer per thread hit the big problem, CPU is more and more faster than IO, waste CPU time to wait for IO response is not good, and with the request increasing, the thread/process context switch is more and more expensive. also each thread will take memory... all of these bring us to think about an other direction to resolve the problem.
    Diagram of :Apache solution for high perfmance -- request per thread
    
    This model actually is mapped to the IO pattern -- Blocking Pattern
    
## Recall C10K problem Reactor Pattern and Proactor Pattern
     15 Years ago, xxx arise C10K problem which was a big chellenge... 
     Explain reactor apttern and proactor pattern:
     
     Those two pattern actually mapped to the two IO pattern:
     
     Non-blocking IO
     
     Async IO
     
     Async IO is ideal, but it really rely on the Operating System support. 
     
     In Linux, the real AIO actually is supported only on Disk IO, Poxis AIO actually introduced thread model, not a real AIO supported from kernel level. For Network IO, we only have non-blocking IO. 
     
     In Linux, for network, we only have multiplux way, 
     
     Explain what is multiplux(diagram)
     
     select, poll, epoll
     
     Select:
     
     Poll:
     
     Epoll: 
     
     Epoll was introduced by a paper, explain a little bit about that paper
     
     Give a timeline of select --> poll --> paper -->epoll
     
     Give a chart about how epoll improve the perf so much
     (file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     
     
     