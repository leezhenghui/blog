#High Performance and High Concurrency Server With Event Loop

# The problem
    15 Years ago, xxx arise C10K problem which was a big chellenge... the Apache, requer per thread hit the big problem, CPU is more and more faster than IO, waste CPU time to wait for IO response is not good, and with the request increasing, the thread/process context switch is more and more expensive. also each thread will take memory... all of these bring us to think about an other direction to resolve the problem.
    Diagram of :Apache solution for high perfmance -- request per thread
    
# Recall C10K problem Reactor Pattern and Proactor Pattern

     Explain reactor apttern and proactor pattern:
     
     Those two pattern actually mapped to the two IO pattern:
     
     Non-blocking IO
     
     Async IO
     
     In Linux, for network, we only have multiplux way, select, poll, epoll
     
     Select:
     
     Poll:
     
     Epoll: 
     
     Epoll was introduced by a paper, explain a little bit about that paper
     
     
     
     