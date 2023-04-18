import { useCallback, useEffect, useRef, useState } from "react";

type RequestedType<T> = {
  data: T[];
  totalPages: number;
};

function useEasyInfiniteScroll<T>(
  requestedData: (pageNumber: number) => Promise<RequestedType<T>>
) {
  const [data, setData] = useState<T[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastElement, setLastElement] = useState<HTMLElement | null>(null);
  const [page, setPage] = useState(1);

  const observer = useRef(
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setPage((prev) => prev + 1);
      }
    })
  );

  const getData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, totalPages } = await requestedData(page);
      if (page === 1) {
        setData(data);
      } else {
        setData((prev) => [...prev, ...data]);
      }
      setTotalPages(totalPages);
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const currentElement = lastElement;
    const currentObserver = observer.current;

    if (currentElement) {
      currentObserver.observe(currentElement);
    }
    return () => {
      if (currentElement) {
        currentObserver.unobserve(currentElement);
      }
    };
  }, [lastElement]);

  useEffect(() => {
    getData();
  }, [page]);

  const resetPage = () => {
    setPage(1);
  };

  return {
    data,
    isLoading,
    setLastElement,
    totalPages,
    page,
    resetPage,
  };
}

export default useEasyInfiniteScroll;
